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
import { tileAt, unitAt } from '../map/accessors.ts';
import { endpointFrom, inRange } from '../map/index.ts';
import { computeMovementProfile } from '../map/movement-profile.ts';
import {
  getUnit,
  type AbilityId,
  type AbilityTarget,
  type Action,
  type Direction,
  type GameState,
  type ItemId,
  type Position,
  type ProposedAction,
  type Unit,
  type UnitId,
} from '../types/index.ts';
import { getLegalMoves, positionKey } from '../map/pathfinding.ts';
import { hasLineOfSight } from '../map/line-of-sight.ts';
import { arcTargetable } from '../map/arc.ts';
import { UnknownDefinitionError } from '../catalog/index.ts';
import { computeMpCost } from '../abilities/cost.ts';
import { computeAbilityRange } from '../abilities/range.ts';
import { isRiderCast } from './payload-helpers.ts';

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
    case 'use_compound':
      return validateUseCompound(state, action, catalog);
    case 'use_throw_item':
      return validateUseThrowItem(state, action, catalog);
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
    case 'system_mp_restore':
    case 'system_mp_drain':
    case 'system_apply_status':
    case 'system_ct_push':
    case 'system_set_ct':
    case 'system_ko_tick':
    case 'system_unit_removed':
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
  //
  // Per Session 31 (ADR-0068 extension): rider casts (`riderSource !==
  // undefined`) also skip the actsAvailable budget check. The original
  // swing already consumed the wielder's Act; the proc fires off the
  // swing (the weapon's power, not the wielder's). Sibling bypass to
  // the MP affordability skip (ADR-0064) below.
  let actor: Unit;
  const isRider = isRiderCast(action.payload);
  if (isReaction) {
    const probe = getActorIfActive(state, action.actorId);
    if ('valid' in probe) return probe;
    actor = probe;
  } else if (isRider) {
    const probe = getActorIfActive(state, action.actorId);
    if ('valid' in probe) return probe;
    actor = probe;
  } else {
    const probe = getCurrentTurnActor(state, action.actorId);
    if ('valid' in probe) return probe;
    actor = probe;

    // Budget: UseAbility requires actsAvailable > 0 (non-reaction,
    // non-rider path).
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

  // MP cost — routed through `computeMpCost` so equipment / status /
  // passive `modifyMpCost` contributors compose into the affordability
  // check (per ADR-0056). Per ADR-0064 (Session 30): rider casts skip
  // the affordability check because the weapon pays the cost, not the
  // wielder — Bolt Hammer's Lightning proc is free of MP, and a Mage
  // with 0 MP still procs Burn off a Flametongue swing.
  if (!isRider) {
    const mpCost = computeMpCost(state, catalog, actor.id, ability.id);
    if (actor.vitals.mp < mpCost) {
      return invalid(
        `Insufficient MP for ${JSON.stringify(ability.id)}: have ${actor.vitals.mp}, need ${mpCost}`,
      );
    }
  }

  // Target check. The targeting union has four kinds: `self`,
  // `single_unit`, `tile`, and `unit_or_tile` (added post-S38 for the
  // FFT-canonical "pin a unit OR pin a tile" charged-spell pattern).
  // Tile-anchored validation lands here in session 15 alongside the
  // throwaway charged ability that exercises it. Per-target dispatch
  // within an AoE (session 17) reuses the same tile validation for the
  // anchor.
  //
  // For `unit_or_tile`, the payload's discriminator selects which
  // validation branch runs. The shared range / LoS / arc checks apply
  // to whichever was picked — there's no separate "unit_or_tile range";
  // both modes use the ability's declared range/rangeMode.
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

  // unit_or_tile: dispatch into the matching mode's branch below
  // based on the payload's discriminator. Reject `self` payloads —
  // the player must pick something concrete.
  if (targetingKind === 'unit_or_tile') {
    if (payloadTargetKind === 'self') {
      return invalid(
        `Ability ${JSON.stringify(ability.id)} requires a unit or tile target (not self)`,
      );
    }
    // Fall through to either the tile branch or the unit branch below.
  }

  if (targetingKind === 'tile' || (targetingKind === 'unit_or_tile' && payloadTargetKind === 'tile')) {
    if (payloadTargetKind !== 'tile') {
      return invalid(`Ability ${JSON.stringify(ability.id)} requires a tile target`);
    }
    const tilePos = (action.payload.target as Extract<AbilityTarget, { kind: 'tile' }>).position;
    const destTile = tileAt(state.map, tilePos.x, tilePos.y, tilePos.layer);
    if (destTile === undefined) {
      return invalid(`Target tile (${tilePos.x},${tilePos.y},${tilePos.layer}) does not exist`);
    }
    // Geometric reach checks (range / LoS / arc). Skipped for rider casts
    // per ADR-0064 extension (S47): the rider's `range` field is vestigial
    // schema noise — the parent attack already determined the target and
    // validated reach. Sibling bypass to the existing MP-cost (ADR-0064)
    // and Act-budget (ADR-0068) skips. Without this, a bow firing at long
    // range crashes when a tight-range proc (Riptide undertow at 1/1)
    // emits against the hit target.
    if (!isRider) {
      const effectiveTileRange = computeAbilityRange(state, catalog, actor.id, ability);
      const tileInRange = inRange({
        source: endpointFrom(actor.position, sourceTile.elevation),
        target: endpointFrom(tilePos, destTile.elevation),
        params: {
          horizontalMax: effectiveTileRange.horizontal,
          horizontalMin: effectiveTileRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
          verticalMax: effectiveTileRange.vertical,
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
    }
    // Session 45: a caster-reposition (Scramble) additionally requires the
    // destination to be enterable terrain for the actor's class and free
    // of any other unit. The relaxed leap (jump delta) is already enforced
    // by the ability's vertical range above; this only adds the
    // land-on-it constraints the generic tile path doesn't impose.
    if (ability.effects.selfMove === true) {
      const profile = computeMovementProfile(state, actor.id, catalog);
      if (!profile.canEnter.has(destTile.terrain)) {
        return invalid('Cannot move onto that terrain');
      }
      const occupant = unitAt(state, tilePos.x, tilePos.y, tilePos.layer);
      if (occupant !== undefined && occupant.id !== actor.id) {
        return invalid('Cannot move onto an occupied tile');
      }
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

  // Geometric reach checks (range / LoS / arc). Skipped for rider casts
  // per ADR-0064 extension (S47): the rider's `range` field is vestigial
  // schema noise — the parent attack already determined the target and
  // validated reach. Sibling bypass to the existing MP-cost (ADR-0064)
  // and Act-budget (ADR-0068) skips. Without this, a bow firing at long
  // range crashes when a tight-range proc (Riptide undertow at 1/1)
  // emits against the hit target.
  if (!isRider) {
    const effectiveUnitRange = computeAbilityRange(state, catalog, actor.id, ability);
    const inRangeOk = inRange({
      source: endpointFrom(actor.position, sourceTile.elevation),
      target: endpointFrom(targetUnit.position, targetTile.elevation),
      params: {
        horizontalMax: effectiveUnitRange.horizontal,
        horizontalMin: effectiveUnitRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
        verticalMax: effectiveUnitRange.vertical,
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
  }

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

// Session 39a: Throw Item is uniform-range across all consumables —
// the brief specifies 3 horizontal × 3 vertical with LoS for v1. A
// per-item override could live on `ConsumableDefinition` later if a
// new item needs different reach (e.g., a longer-range thrown bomb);
// for the v1 four-item set the constant is fine.
export const THROW_ITEM_RANGE = { horizontal: 3, vertical: 3 } as const;

// Session 39a: Compound — Alchemist banks one of the selected item into
// stockpile. Gated by: actor is active turn, Act budget available,
// item exists in catalog, item is a consumable, sufficient MP for the
// item's compoundMpCost. The unit's stockpile size is unbounded in
// v1 (no stockpile cap per Chris's confirmation).
function validateUseCompound(
  state: GameState,
  action: { readonly actorId?: UnitId; readonly payload: { readonly itemId: ItemId } },
  catalog: Catalog,
): ValidationResult {
  if (action.actorId === undefined) return invalid('Compound action requires an actorId');
  const actor = getCurrentTurnActor(state, action.actorId);
  if ('valid' in actor) return actor;

  const turn = state.turnState!;
  if (turn.budget.actsAvailable <= 0) {
    return invalid('No Act budget remaining this turn');
  }

  let item;
  try {
    item = catalog.getItem(action.payload.itemId);
  } catch (err: unknown) {
    if (err instanceof UnknownDefinitionError) {
      return invalid(`Unknown item ${JSON.stringify(action.payload.itemId)}`);
    }
    throw err;
  }
  if (item.kind !== 'consumable') {
    return invalid(
      `Item ${JSON.stringify(action.payload.itemId)} is not a consumable — cannot Compound`,
    );
  }
  if (actor.vitals.mp < item.compoundMpCost) {
    return invalid(
      `Insufficient MP for Compound (${item.name}): have ${actor.vitals.mp}, need ${item.compoundMpCost}`,
    );
  }
  return VALID;
}

// Session 39a: Throw Item — Alchemist consumes one of the selected item
// from stockpile and applies its effects to the target. Range 3h × 3v
// with LoS. KO'd targets are valid (Phoenix Down revives them); the
// non-revival items apply gated zero to KO'd targets.
function validateUseThrowItem(
  state: GameState,
  action: {
    readonly actorId?: UnitId;
    readonly payload: { readonly itemId: ItemId; readonly target: AbilityTarget };
  },
  catalog: Catalog,
): ValidationResult {
  if (action.actorId === undefined) return invalid('Throw Item action requires an actorId');
  const actor = getCurrentTurnActor(state, action.actorId);
  if ('valid' in actor) return actor;

  const turn = state.turnState!;
  if (turn.budget.actsAvailable <= 0) {
    return invalid('No Act budget remaining this turn');
  }

  let item;
  try {
    item = catalog.getItem(action.payload.itemId);
  } catch (err: unknown) {
    if (err instanceof UnknownDefinitionError) {
      return invalid(`Unknown item ${JSON.stringify(action.payload.itemId)}`);
    }
    throw err;
  }
  if (item.kind !== 'consumable') {
    return invalid(
      `Item ${JSON.stringify(action.payload.itemId)} is not a consumable — cannot Throw`,
    );
  }

  // Stockpile gate: must have at least one of the item.
  const have = actor.stockpile.get(item.id) ?? 0;
  if (have <= 0) {
    return invalid(`No ${item.name} in stockpile`);
  }

  // Target must be a unit (Throw Item is single-target in v1).
  if (action.payload.target.kind !== 'unit') {
    return invalid('Throw Item requires a unit target');
  }
  const targetUnitId = action.payload.target.unitId;
  let targetUnit;
  try {
    targetUnit = getUnit(state, targetUnitId);
  } catch {
    return invalid(`Target unit ${JSON.stringify(targetUnitId)} does not exist`);
  }
  // Removed units (permadeath, S39a) are not targetable. KO'd units
  // still are — Phoenix Down revives, other items fizzle.
  if (targetUnit.removed) {
    return invalid(`Target unit ${JSON.stringify(targetUnitId)} has been removed from battle`);
  }

  // Range + arc-targetability against the throw-item constant. Per
  // Chris's S39b bug report: throws use arc-style reach (any tile
  // within 3h × 3v with uncovered source + target), not straight-line.
  // Matches the spell-targeting convention so a Throw at (+2, +1) is
  // legal, not just orthogonal rows / columns.
  const sourceTile = tileAt(state.map, actor.position.x, actor.position.y, actor.position.layer);
  if (sourceTile === undefined) return invalid('Source tile does not exist');
  const targetTile = tileAt(
    state.map,
    targetUnit.position.x,
    targetUnit.position.y,
    targetUnit.position.layer,
  );
  if (targetTile === undefined) return invalid('Target tile does not exist');
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const inRangeOk = inRange({
    source: endpointFrom(actor.position, sourceTile.elevation),
    target: endpointFrom(targetUnit.position, targetTile.elevation),
    params: {
      horizontalMax: THROW_ITEM_RANGE.horizontal,
      horizontalMin: ruleset.rangeDefaults.minHorizontal,
      verticalMax: THROW_ITEM_RANGE.vertical,
    },
  });
  if (!inRangeOk) return invalid('Target is out of throw range');
  const arcOk = arcTargetable(state.map, actor.position, targetUnit.position);
  if (!arcOk) return invalid('Arc target is covered');
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
