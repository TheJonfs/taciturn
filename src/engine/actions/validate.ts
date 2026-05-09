// validateAction — pure check that an action is legal as the next
// action in the current state. See
// docs/design/action-resolution.md ("Validation").
//
// Two layers:
//   1. Universal invariants (actor exists, KO check, target exists,
//      resources non-negative). Hardcoded; not overridable.
//   2. Contextual rules — TurnBudget consumption + range / targeting
//      checks. Modifiable per ability via the action's payload data;
//      static rules only here.
//
// Pre-resolution hooks (`onActionAttempted` — Stop, Berserk, Silence)
// fire in `commitAction`, *not* here, because validation must be pure
// and side-effect-free. Hooks can refuse an action at commit time even
// after this function returns valid; both layers are gates.

import type { ActiveAbilityDefinition, Catalog, RangeMode } from '../catalog/index.ts';
import { tileAt } from '../map/accessors.ts';
import { endpointFrom, inRange } from '../map/index.ts';
import {
  getUnit,
  type AbilityId,
  type AbilityTarget,
  type Action,
  type Direction,
  type GameState,
  type Position,
  type ProposedAction,
  type Unit,
  type UnitId,
} from '../types/index.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { hasLineOfSight } from '../map/line-of-sight.ts';
import { arcTargetable } from '../map/arc.ts';
import { UnknownDefinitionError } from '../catalog/index.ts';

export interface ValidationResult {
  readonly valid: boolean;
  // Human-readable reason. Required when invalid; absent when valid.
  readonly reason?: string;
}

const VALID: ValidationResult = { valid: true };

function invalid(reason: string): ValidationResult {
  return { valid: false, reason };
}

// Validates a proposed action against the current state. The Action /
// ProposedAction split: ProposedAction is what controllers hand the
// engine (no envelope yet); Action is what's in the log. validate
// accepts either — it only reads payload + actor + type.
//
// `opts.isReaction` lets reactions skip the active-turn / turn-budget
// checks: a reaction (Counter, Auto-Potion, Reflect) fires during
// another unit's turn and consumes from a separate per-unit-per-turn
// reaction counter — both bookkept by `commitAction`. Universal
// invariants (actor exists, KO check, ability exists, MP cost, range)
// still apply.
export interface ValidateOptions {
  readonly isReaction?: boolean;
}

export function validateAction(
  state: GameState,
  action: ProposedAction | Action,
  catalog: Catalog,
  opts?: ValidateOptions,
): ValidationResult {
  const isReaction = opts?.isReaction ?? false;
  // Per-kind dispatch. Each branch handles its own universal checks
  // before falling into the contextual ones.
  switch (action.type) {
    case 'move':
      return validateMove(state, action, catalog);
    case 'use_ability':
      return validateUseAbility(state, action, catalog, isReaction);
    case 'wait':
      return validateWait(state, action);
    case 'set_facing':
      return validateSetFacing(state, action);
    case 'turn_start':
    case 'turn_end':
    case 'status_tick':
    case 'charged_action_resolve':
    case 'system_heal':
    case 'system_damage':
    case 'system_apply_status':
    case 'system_ct_push':
    case 'status_remove':
    case 'status_decrement_stack':
    case 'battle_end':
      // System actions are engine-emitted; the engine is trusted to
      // emit them only when state allows. Validation is a pass-through.
      // Universal-invariant checks against bad emissions live in the
      // reducer (which throws on impossible state).
      return VALID;
  }
}

function getActorIfActive(state: GameState, unitId: UnitId): Unit | ValidationResult {
  let unit: Unit;
  try {
    unit = getUnit(state, unitId);
  } catch {
    return invalid(`Unit ${JSON.stringify(unitId)} does not exist`);
  }
  if (unit.vitals.hp <= 0) {
    return invalid(`Unit ${JSON.stringify(unitId)} is KO'd and cannot act`);
  }
  return unit;
}

// Compares a checked-out actor to whatever wider context demands of it.
// Returns the unit when valid, or the validation failure when not.
function getCurrentTurnActor(
  state: GameState,
  proposedActorId: UnitId,
): Unit | ValidationResult {
  const probe = getActorIfActive(state, proposedActorId);
  if ('valid' in probe) return probe;
  if (state.turnState === null) {
    return invalid(`No turn is in progress; ${JSON.stringify(proposedActorId)} cannot act`);
  }
  if (state.turnState.unitId !== proposedActorId) {
    return invalid(
      `Action proposed by ${JSON.stringify(proposedActorId)} but the active turn belongs to ${JSON.stringify(state.turnState.unitId)}`,
    );
  }
  return probe;
}

function validateMove(
  state: GameState,
  action: { readonly actorId?: UnitId; readonly payload: { readonly destination: Position } },
  catalog: Catalog,
): ValidationResult {
  if (action.actorId === undefined) return invalid('Move action requires an actorId');
  const actor = getCurrentTurnActor(state, action.actorId);
  if ('valid' in actor) return actor;

  // Budget: Move requires movesAvailable > 0.
  const turn = state.turnState!;
  if (turn.budget.movesAvailable <= 0) {
    return invalid('No Move budget remaining this turn');
  }

  // Destination tile must exist.
  const dest = action.payload.destination;
  const destTile = tileAt(state.map, dest.x, dest.y, dest.layer);
  if (destTile === undefined) {
    return invalid(`Destination tile (${dest.x},${dest.y},${dest.layer}) does not exist`);
  }

  // Destination must be reachable per the move engine. Re-runs
  // pathfinding here; the reducer re-runs it too to extract the path.
  // Cost is small at v1 map sizes; if a hot path emerges, callers can
  // memoize or the reducer can pass its result back.
  const moves = getLegalMoves(state, actor.id, catalog);
  if (!moves.reachable.has(positionKey(dest))) {
    return invalid('Destination is not reachable from current position');
  }
  return VALID;
}

function validateUseAbility(
  state: GameState,
  action: {
    readonly actorId?: UnitId;
    readonly payload: { readonly abilityId: AbilityId; readonly target: AbilityTarget };
  },
  catalog: Catalog,
  isReaction: boolean,
): ValidationResult {
  if (action.actorId === undefined) return invalid('UseAbility action requires an actorId');

  // Reactions skip both the active-turn check and the actsAvailable
  // budget check — they fire during another unit's turn and draw from
  // a separate per-unit-per-turn counter. The actor still has to exist
  // and not be KO'd.
  let actor: Unit;
  if (isReaction) {
    const probe = getActorIfActive(state, action.actorId);
    if ('valid' in probe) return probe;
    actor = probe;
  } else {
    const probe = getCurrentTurnActor(state, action.actorId);
    if ('valid' in probe) return probe;
    actor = probe;

    // Budget: UseAbility requires actsAvailable > 0 (non-reaction path).
    const turn = state.turnState!;
    if (turn.budget.actsAvailable <= 0) {
      return invalid('No Act budget remaining this turn');
    }
  }

  // Ability must exist and be active.
  let ability;
  try {
    ability = catalog.getAbility(action.payload.abilityId);
  } catch (err: unknown) {
    if (err instanceof UnknownDefinitionError) {
      return invalid(`Unknown ability ${JSON.stringify(action.payload.abilityId)}`);
    }
    throw err;
  }
  if (ability.kind !== 'active') {
    return invalid(
      `Ability ${JSON.stringify(action.payload.abilityId)} is passive — cannot UseAbility on it`,
    );
  }

  // MP cost.
  if (actor.vitals.mp < ability.mpCost) {
    return invalid(
      `Insufficient MP for ${JSON.stringify(ability.id)}: have ${actor.vitals.mp}, need ${ability.mpCost}`,
    );
  }

  // Target check. The targeting union has three kinds: `self`,
  // `single_unit`, and `tile`. Tile-anchored validation lands here in
  // session 15 alongside the throwaway charged ability that exercises
  // it. Per-target dispatch within an AoE (session 17) reuses the same
  // tile validation for the anchor.
  const targetingKind = ability.targeting.kind;
  const payloadTargetKind = action.payload.target.kind;

  if (targetingKind === 'self') {
    if (payloadTargetKind !== 'self') {
      return invalid(`Ability ${JSON.stringify(ability.id)} targets self only`);
    }
    return VALID;
  }

  const ruleset = catalog.getRuleset(state.ruleset.id);
  const sourceTile = tileAt(state.map, actor.position.x, actor.position.y, actor.position.layer);
  if (sourceTile === undefined) {
    return invalid('Source tile does not exist');
  }

  if (targetingKind === 'tile') {
    if (payloadTargetKind !== 'tile') {
      return invalid(`Ability ${JSON.stringify(ability.id)} requires a tile target`);
    }
    const tilePos = (action.payload.target as Extract<AbilityTarget, { kind: 'tile' }>).position;
    const destTile = tileAt(state.map, tilePos.x, tilePos.y, tilePos.layer);
    if (destTile === undefined) {
      return invalid(`Target tile (${tilePos.x},${tilePos.y},${tilePos.layer}) does not exist`);
    }
    const tileInRange = inRange({
      source: endpointFrom(actor.position, sourceTile.elevation),
      target: endpointFrom(tilePos, destTile.elevation),
      params: {
        horizontalMax: ability.targeting.range.horizontal,
        horizontalMin: ability.targeting.range.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
        verticalMax: ability.targeting.range.vertical,
      },
    });
    if (!tileInRange) return invalid('Target tile is out of range');

    const tileRangeMode: RangeMode = ability.targeting.rangeMode;
    if (tileRangeMode === 'straight_line') {
      const losOk = hasLineOfSight(
        state.map,
        endpointFrom(actor.position, sourceTile.elevation),
        endpointFrom(tilePos, destTile.elevation),
      );
      if (!losOk) return invalid('Line of sight is blocked');
    } else if (tileRangeMode === 'arc') {
      const arcOk = arcTargetable(state.map, actor.position, tilePos);
      if (!arcOk) return invalid('Arc target is covered');
    }
    return VALID;
  }

  // single_unit
  if (payloadTargetKind !== 'unit') {
    return invalid(`Ability ${JSON.stringify(ability.id)} requires a unit target`);
  }
  const targetUnitId = (action.payload.target as Extract<AbilityTarget, { kind: 'unit' }>).unitId;
  let targetUnit;
  try {
    targetUnit = getUnit(state, targetUnitId);
  } catch {
    return invalid(`Target unit ${JSON.stringify(targetUnitId)} does not exist`);
  }

  // Range + targeting-mode checks. Resolve target tile for elevation
  // lookups; tile-not-found is an inconsistency caught here.
  const targetTile = tileAt(state.map, targetUnit.position.x, targetUnit.position.y, targetUnit.position.layer);
  if (targetTile === undefined) {
    return invalid('Target tile does not exist');
  }
  const inRangeOk = inRange({
    source: endpointFrom(actor.position, sourceTile.elevation),
    target: endpointFrom(targetUnit.position, targetTile.elevation),
    params: {
      horizontalMax: ability.targeting.range.horizontal,
      horizontalMin: ability.targeting.range.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
      verticalMax: ability.targeting.range.vertical,
    },
  });
  if (!inRangeOk) return invalid('Target is out of range');

  const rangeMode: RangeMode = ability.targeting.rangeMode;
  if (rangeMode === 'straight_line') {
    const losOk = hasLineOfSight(
      state.map,
      endpointFrom(actor.position, sourceTile.elevation),
      endpointFrom(targetUnit.position, targetTile.elevation),
    );
    if (!losOk) return invalid('Line of sight is blocked');
  } else if (rangeMode === 'arc') {
    const arcOk = arcTargetable(state.map, actor.position, targetUnit.position);
    if (!arcOk) return invalid('Arc target is covered');
  }
  // 'melee' has no extra check beyond range.

  return VALID;
}

function validateWait(
  state: GameState,
  action: { readonly actorId?: UnitId },
): ValidationResult {
  if (action.actorId === undefined) return invalid('Wait action requires an actorId');
  const actor = getCurrentTurnActor(state, action.actorId);
  if ('valid' in actor) return actor;
  return VALID;
}

function validateSetFacing(
  state: GameState,
  action: { readonly actorId?: UnitId; readonly payload: { readonly facing: Direction } },
): ValidationResult {
  if (action.actorId === undefined) return invalid('SetFacing action requires an actorId');
  const actor = getCurrentTurnActor(state, action.actorId);
  if ('valid' in actor) return actor;
  void action;
  return VALID;
}

// `validateActiveAbility` exposed for callers that want the ability
// after it's been validated (the reducer, primarily).
export function expectActiveAbility(
  catalog: Catalog,
  abilityId: AbilityId,
): ActiveAbilityDefinition {
  const ability = catalog.getAbility(abilityId);
  if (ability.kind !== 'active') {
    throw new Error(
      `expectActiveAbility: ability ${JSON.stringify(abilityId)} is passive`,
    );
  }
  return ability;
}
