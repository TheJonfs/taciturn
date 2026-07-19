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
import { runModifyAttackerElevation } from '../hooks/runners.ts';
import { hasLineOfSight } from '../map/line-of-sight.ts';
import { arcTargetable } from '../map/arc.ts';
import { UnknownDefinitionError } from '../catalog/index.ts';
import { computeMpCost } from '../abilities/cost.ts';
import { bridgeFallLanding, buildElevationCast } from '../abilities/worldcraft-resolution.ts';
import { computeAbilityRange } from '../abilities/range.ts';
import { rangeFromHeightBonus, weaponRangeFromHeightSpec } from '../abilities/range-height.ts';
import { isRiderCast } from './payload-helpers.ts';
import { weaponAttackAoeSpec } from '../items/weapon-attack-aoe.ts';

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
    case 'system_cover_redirect':
    case 'system_set_ct':
    case 'system_ko_tick':
    case 'system_xp_award':
    case 'system_unit_removed':
    case 'system_terrain_change':
    case 'system_barrier_change':
    case 'system_barrier_damage':
    case 'system_bridge_destroy':
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

  // TABA M2 progression gating: a VOLITIONAL cast must be in the actor's
  // active allowlist when one is present (`usableActives === undefined` ⇒
  // ungated — the Mage War default, so the engine stays progression-ignorant).
  // Rider casts (weapon procs) and reactions are engine-generated, not player-
  // chosen, so they bypass the gate — the same carve-out as the MP / budget
  // bypasses above. The allowlist already includes the class's free abilities.
  if (
    !isReaction &&
    !isRider &&
    actor.usableActives !== undefined &&
    !actor.usableActives.has(ability.id)
  ) {
    return invalid(`Ability ${JSON.stringify(ability.id)} is locked for this unit`);
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
  // TABA Ch3 (Volley Bow): a weapon-declared attack AoE lets the basic
  // Attack aim at an EMPTY tile (the starting-cluster opener) — the tile
  // branch below then applies the same weapon-ranged reach checks the
  // unit branch uses (bows: no LoS gate — the attack's rangeMode is
  // 'melee', and bows canonically arc). The UI's target enumeration
  // reads the same `weaponAttackAoeSpec`, so offer and gate can't drift.
  const weaponAoeTileAim =
    targetingKind === 'single_unit' &&
    ability.basicAttack === true &&
    weaponAttackAoeSpec(actor, catalog, ability) !== undefined;

  if (targetingKind === 'self') {
    if (payloadTargetKind !== 'self') {
      return invalid(`Ability ${JSON.stringify(ability.id)} targets self only`);
    }
    return VALID;
  }

  // Session 49 / ADR-0086: Math Skill targeting validates the payload's
  // parameter + value shape. No range, LoS, or arc check — the cast
  // is battlefield-wide and resolves against units matching the
  // predicate at reduce time. Empty matching sets are still valid casts
  // (the player loses the MP base but no per-target term applies).
  if (targetingKind === 'math_skill') {
    if (payloadTargetKind !== 'math_skill') {
      return invalid(
        `Ability ${JSON.stringify(ability.id)} requires a math_skill target (parameter + value)`,
      );
    }
    const mathPayload = action.payload.target as Extract<
      AbilityTarget,
      { kind: 'math_skill' }
    >;
    const validParams: ReadonlyArray<string> = ['ct', 'height', 'level', 'current_hp'];
    if (!validParams.includes(mathPayload.parameter)) {
      return invalid(
        `Invalid Math Skill parameter ${JSON.stringify(mathPayload.parameter)}`,
      );
    }
    const validValues: ReadonlyArray<string | number> = ['prime', 3, 4, 5];
    if (!validValues.includes(mathPayload.value)) {
      return invalid(`Invalid Math Skill value ${JSON.stringify(mathPayload.value)}`);
    }
    // TABA M2: combinator gate — the picked Parameter and Value must be
    // unlocked for this unit. Ungated when the allowlists are undefined.
    if (
      actor.usableMathParameters !== undefined &&
      !actor.usableMathParameters.has(mathPayload.parameter)
    ) {
      return invalid(
        `Math Skill parameter ${JSON.stringify(mathPayload.parameter)} is locked for this unit`,
      );
    }
    if (actor.usableMathValues !== undefined && !actor.usableMathValues.has(mathPayload.value)) {
      return invalid(`Math Skill value ${JSON.stringify(mathPayload.value)} is locked for this unit`);
    }
    return VALID;
  }

  const ruleset = catalog.getRuleset(state.ruleset.id);
  const sourceTile = tileAt(state.map, actor.position.x, actor.position.y, actor.position.layer);
  if (sourceTile === undefined) {
    return invalid('Source tile does not exist');
  }
  // S68 (Vantage, ADR-0115): the actor's *offensive* elevation — used for
  // line-of-sight ("shoot over cover") and bow reach-from-height, where a
  // Vantage wielder aims as if standing higher. Vertical-range (`inRange`)
  // deliberately stays on the raw `sourceTile.elevation` (Vantage doesn't
  // change whether the unit is in someone's — or its own — vertical reach).
  const offensiveSourceElevation = runModifyAttackerElevation(state, catalog, {
    unit: actor,
    baseValue: sourceTile.elevation,
  });

  // Session 76: grapple-throw targeting — the Monk's Bear's Heave. Validates
  // the grab reach (throwee within range, like single_unit), the throw radius
  // (destination within a Manhattan diamond of the throwee's CURRENT tile), an
  // existing + unoccupied + barrier-free destination, and an upward-elevation
  // ceiling (downward is unbounded — ledge throws are the point).
  if (targetingKind === 'grapple_throw') {
    if (payloadTargetKind !== 'grapple_throw') {
      return invalid(`Ability ${JSON.stringify(ability.id)} requires a grapple_throw target`);
    }
    const throwPayload = action.payload.target as Extract<
      AbilityTarget,
      { kind: 'grapple_throw' }
    >;
    let throwee: Unit;
    try {
      throwee = getUnit(state, throwPayload.unitId);
    } catch {
      return invalid(`Throw target ${JSON.stringify(throwPayload.unitId)} does not exist`);
    }
    if (throwee.id === actor.id) {
      return invalid('Cannot throw yourself');
    }
    if (throwee.airborne) {
      return invalid(`Throw target ${JSON.stringify(throwPayload.unitId)} is airborne and cannot be grabbed`);
    }
    if (throwee.vitals.hp <= 0) {
      return invalid("Cannot grab a KO'd unit");
    }
    const throweeTile = tileAt(
      state.map,
      throwee.position.x,
      throwee.position.y,
      throwee.position.layer,
    );
    if (throweeTile === undefined) {
      return invalid('Throw target stands on a non-existent tile');
    }
    // Grab reach — parallel to single_unit. Skipped for rider casts (no v1
    // rider throws, but the bypass keeps the shape uniform).
    if (!isRider) {
      const grabRange = computeAbilityRange(state, catalog, actor.id, ability);
      const grabOk = inRange({
        source: endpointFrom(actor.position, sourceTile.elevation),
        target: endpointFrom(throwee.position, throweeTile.elevation),
        params: {
          horizontalMax: grabRange.horizontal,
          horizontalMin: grabRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
          verticalMax: grabRange.vertical,
        },
      });
      if (!grabOk) return invalid('Throw target is out of grab range');
    }
    // Destination: in-bounds, exists, unoccupied, barrier-free.
    const dest = throwPayload.destination;
    if (dest.x < 0 || dest.y < 0 || dest.x >= state.map.width || dest.y >= state.map.height) {
      return invalid(`Destination tile (${dest.x},${dest.y},${dest.layer}) does not exist`);
    }
    const throwDestTile = tileAt(state.map, dest.x, dest.y, dest.layer);
    if (throwDestTile === undefined) {
      return invalid(`Destination tile (${dest.x},${dest.y},${dest.layer}) does not exist`);
    }
    const destOccupant = unitAt(state, dest.x, dest.y, dest.layer);
    if (destOccupant !== undefined && destOccupant.id !== throwee.id) {
      return invalid('Cannot throw onto an occupied tile');
    }
    if (throwDestTile.barrier !== undefined) {
      return invalid('Cannot throw onto a barrier tile');
    }
    // Throw radius — Manhattan diamond around the throwee's current tile.
    const manhattan =
      Math.abs(dest.x - throwee.position.x) + Math.abs(dest.y - throwee.position.y);
    if (manhattan === 0) {
      return invalid('Destination must differ from the current tile');
    }
    if (manhattan > ability.targeting.throwRadius) {
      return invalid('Destination is outside the throw radius');
    }
    // Upward elevation ceiling (downward unbounded — ledge throws are the point).
    if (throwDestTile.elevation - throweeTile.elevation > ability.targeting.throwVerticalTolerance) {
      return invalid('Cannot throw a unit up that high');
    }
    return VALID;
  }

  // Session 54: barrier-as-target. A damaging ability aimed at a tile that
  // bears a barrier is valid even if its declared targeting requires a unit
  // (a basic Attack is `single_unit`, but you can swing at a wall). Range /
  // LoS / arc are checked against the barrier tile per the ability's own
  // range; resolution routes the hit to `system_barrier_damage`. Self and
  // math_skill targeting carry no range and never damage a tile object.
  if (
    ability.effects.damage !== undefined &&
    payloadTargetKind === 'tile' &&
    targetingKind !== 'tile_set'
  ) {
    const tilePos = action.payload.target.position;
    const destTile = tileAt(state.map, tilePos.x, tilePos.y, tilePos.layer);
    if (destTile !== undefined && destTile.barrier !== undefined) {
      if (!isRider) {
        const effRange = computeAbilityRange(state, catalog, actor.id, ability);
        const inR = inRange({
          source: endpointFrom(actor.position, sourceTile.elevation),
          target: endpointFrom(tilePos, destTile.elevation),
          params: {
            horizontalMax: effRange.horizontal,
            horizontalMin: effRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
            verticalMax: effRange.vertical,
          },
        });
        if (!inR) return invalid('Barrier target is out of range');
        if (ability.targeting.rangeMode === 'straight_line') {
          if (!hasLineOfSight(
            state.map,
            endpointFrom(actor.position, offensiveSourceElevation),
            endpointFrom(tilePos, destTile.elevation),
          )) {
            return invalid('Line of sight is blocked');
          }
        } else if (ability.targeting.rangeMode === 'arc') {
          if (!arcTargetable(state.map, actor.position, tilePos)) {
            return invalid('Arc target is covered');
          }
        }
      }
      return VALID;
    }
  }

  // Session 54: tile_set targeting — the Worldcraft Barrier ability. A
  // contiguous straight horizontal/vertical line of `minLength`-`maxLength`
  // tiles, each within range of the caster. Barrier placement additionally
  // requires every tile to exist, be unoccupied, and be barrier-free
  // (parallel to selfMove's destination check — an effect-specific rule
  // layered onto the generic line selection). No LoS/arc per tile: building
  // a wall doesn't require sight.
  if (targetingKind === 'tile_set') {
    if (payloadTargetKind !== 'tile_set') {
      return invalid(`Ability ${JSON.stringify(ability.id)} requires a tile_set target`);
    }
    const positions = action.payload.target.positions;
    if (positions.length < ability.targeting.minLength || positions.length > ability.targeting.maxLength) {
      return invalid(
        `Tile-set target must be ${ability.targeting.minLength}-${ability.targeting.maxLength} contiguous tiles (got ${positions.length})`,
      );
    }
    if (positions.length === 0) return invalid('Tile-set target is empty');
    // Single layer, single straight axis, no duplicates, no gaps.
    const layer = positions[0]!.layer;
    if (!positions.every((p) => p.layer === layer)) {
      return invalid('Tile-set target must lie on a single layer');
    }
    const seen = new Set<string>();
    for (const p of positions) {
      const key = positionKey(p);
      if (seen.has(key)) return invalid('Tile-set target has duplicate tiles');
      seen.add(key);
    }
    const allSameY = positions.every((p) => p.y === positions[0]!.y);
    const allSameX = positions.every((p) => p.x === positions[0]!.x);
    if (!allSameX && !allSameY) {
      return invalid('Tile-set target must be a straight horizontal or vertical line');
    }
    const axisCoords = (allSameY ? positions.map((p) => p.x) : positions.map((p) => p.y)).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < axisCoords.length; i++) {
      if (axisCoords[i]! !== axisCoords[i - 1]! + 1) {
        return invalid('Tile-set target must be contiguous (no gaps)');
      }
    }
    // Per-tile range + existence + barrier-placement legality.
    const effectiveRange = computeAbilityRange(state, catalog, actor.id, ability);
    const isBarrier = ability.effects.worldcraft?.kind === 'barrier';
    for (const p of positions) {
      // Bounds-check before `tileAt` (which throws off-map per ADR-0002).
      // The AI enumerating Worldcraft tile sets near a map edge can produce
      // off-map positions; treat those as invalid, not a programmer error.
      if (p.x < 0 || p.y < 0 || p.x >= state.map.width || p.y >= state.map.height) {
        return invalid(`Target tile (${p.x},${p.y},${p.layer}) does not exist`);
      }
      const tile = tileAt(state.map, p.x, p.y, p.layer);
      if (tile === undefined) {
        return invalid(`Target tile (${p.x},${p.y},${p.layer}) does not exist`);
      }
      const tileInRange = inRange({
        source: endpointFrom(actor.position, sourceTile.elevation),
        target: endpointFrom(p, tile.elevation),
        params: {
          horizontalMax: effectiveRange.horizontal,
          horizontalMin: effectiveRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
          verticalMax: effectiveRange.vertical,
        },
      });
      if (!tileInRange) return invalid('Tile-set target is out of range');
      if (isBarrier) {
        if (tile.barrier !== undefined) {
          return invalid('Cannot place a barrier on a tile that already has one');
        }
        if (unitAt(state, p.x, p.y, p.layer) !== undefined) {
          return invalid('Cannot place a barrier on an occupied tile');
        }
      }
    }
    return VALID;
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

  if (
    targetingKind === 'tile' ||
    (targetingKind === 'unit_or_tile' && payloadTargetKind === 'tile') ||
    (weaponAoeTileAim && payloadTargetKind === 'tile')
  ) {
    if (payloadTargetKind !== 'tile') {
      return invalid(`Ability ${JSON.stringify(ability.id)} requires a tile target`);
    }
    const tilePos = (action.payload.target as Extract<AbilityTarget, { kind: 'tile' }>).position;
    // Bounds-check before `tileAt` (which throws off-map per ADR-0002), so an
    // off-map tile target reads as invalid rather than a thrown error.
    if (
      tilePos.x < 0 || tilePos.y < 0 ||
      tilePos.x >= state.map.width || tilePos.y >= state.map.height
    ) {
      return invalid(`Target tile (${tilePos.x},${tilePos.y},${tilePos.layer}) does not exist`);
    }
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
      // Session 52: add the bow height-range bonus when the shooter is
      // above the target tile (no-op for non-bow / level / uphill shots).
      const tileHeightBonus = rangeFromHeightBonus(
        weaponRangeFromHeightSpec(actor, catalog, ability),
        offensiveSourceElevation,
        destTile.elevation,
      );
      const tileInRange = inRange({
        source: endpointFrom(actor.position, sourceTile.elevation),
        target: endpointFrom(tilePos, destTile.elevation),
        params: {
          horizontalMax: effectiveTileRange.horizontal + tileHeightBonus,
          horizontalMin: effectiveTileRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
          verticalMax: effectiveTileRange.vertical,
        },
      });
      if (!tileInRange) return invalid('Target tile is out of range');

      const tileRangeMode: RangeMode = ability.targeting.rangeMode;
      if (tileRangeMode === 'straight_line') {
        const losOk = hasLineOfSight(
          state.map,
          endpointFrom(actor.position, offensiveSourceElevation),
          endpointFrom(tilePos, destTile.elevation),
        );
        if (!losOk) return invalid('Line of sight is blocked');
      } else if (tileRangeMode === 'arc') {
        // S96 (bridges, ADR-0155): elevation Worldcraft is EXEMPT from the
        // arc cover gate — it shapes the earth from below, not a projectile
        // from above, so a deck overhead doesn't protect the ground beneath
        // it (the RAM rule depends on casting under a span). Everything
        // else keeps the cover rule: a bridge shields from lobs.
        const isElevationWorldcraft = ability.effects.worldcraft?.kind === 'elevation';
        if (!isElevationWorldcraft) {
          const arcOk = arcTargetable(state.map, actor.position, tilePos);
          if (!arcOk) return invalid('Arc target is covered');
        }
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
    // Session 55: reject an elevation Worldcraft cast (Pillar/Pit/Hill/Valley)
    // that would change no tiles — e.g. a net-lowering Valley/Pit whose whole
    // kernel is already on the water floor (elevation floored at 0). Without
    // this gate the cast committed silently: MP + Act spent, a queue slot
    // consumed, zero visible effect (Chris's "returned to menu" report). Reuse
    // the resolver's own kernel builder so validation can't drift from it; a
    // *partial* cast (some tiles change) stays valid.
    //
    // S96 (bridges, ADR-0155): the builder now also reports deck DESTROYS —
    // a destroying cast is an effect (Pit on a bridge is the point). A raise
    // aimed at a deck gets its own message (there is no earth up there), and
    // a destroy whose occupant would have nowhere to land (under-tile and
    // all four cardinal neighbors occupied/missing — pathological) is
    // rejected loud rather than crashing the reducer.
    const elevationSpec = ability.effects.worldcraft;
    if (elevationSpec?.kind === 'elevation') {
      const { tileChanges, destroyTiles } = buildElevationCast(state, tilePos, elevationSpec.deltas);
      if (tileChanges.length === 0 && destroyTiles.length === 0) {
        const anchorTile = tileAt(state.map, tilePos.x, tilePos.y, tilePos.layer);
        if (anchorTile !== undefined && anchorTile.layer >= 1) {
          return invalid('Cannot raise a bridge — there is no earth to shape');
        }
        return invalid('Target area would not be affected by this ability');
      }
      for (const d of destroyTiles) {
        const occupant = unitAt(state, d.x, d.y, d.layer);
        if (occupant !== undefined && bridgeFallLanding(state, d.x, d.y, occupant.id) === null) {
          return invalid('No landing below the collapsing bridge');
        }
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
  // Airborne units (Dragoon Jump mid-leap, S62 / ADR-0103) are untargetable
  // — they're off-field until the leap resolves.
  if (targetUnit.airborne) {
    return invalid(`Target unit ${JSON.stringify(targetUnitId)} is airborne and cannot be targeted`);
  }

  // Steal Heart (control-override) gates (Thief — ADR-0111). Opposite-gender,
  // a living target, and not already control-overridden / warded against
  // re-charm. The override / immunity are tested via generic StatusEffectType
  // flags, so the engine stays decoupled from the specific content ids.
  if (ability.effects.stealHeart !== undefined) {
    if (targetUnit.vitals.hp <= 0) {
      return invalid("Steal Heart cannot target a KO'd unit");
    }
    // Resolve each unit's gender, falling back to its class default when a
    // placement left `gender` unset (default-team units that never had the
    // gender toggle clicked). Every unit has a concrete resolved gender —
    // the same one the portrait shows — so Steal Heart can judge opposite-
    // gender targeting even when the field is absent in state.
    const actorGender =
      actor.gender ?? catalog.getClass(actor.classState.currentClass).defaultGender ?? 'male';
    const targetGender =
      targetUnit.gender ??
      catalog.getClass(targetUnit.classState.currentClass).defaultGender ??
      'male';
    if (actorGender === targetGender) {
      return invalid('Steal Heart requires a target of the opposite gender');
    }
    const alreadyOverridden = targetUnit.statuses.some(
      (s) => catalog.getStatusType(s.typeId).controlOverride === true,
    );
    const warded = targetUnit.statuses.some(
      (s) => catalog.getStatusType(s.typeId).controlOverrideImmune === true,
    );
    if (alreadyOverridden || warded) {
      return invalid('Target is already enthralled or warded against Steal Heart');
    }
  }

  // Revive abilities (the Templar's Raise) target only KO'd allies — a downed
  // unit to bring back. Per Chris (playtest, amending ADR-0099): Raise no
  // longer doubles as a heal on a living target, which let the AI mis-cast it
  // as a healing spell. A `removed` unit is permanently gone and can't be
  // raised either. The consumable Phoenix Down path keeps its own removeKO
  // handling; this gate is for the UseAbility validation only.
  if (ability.effects.removeKO === true) {
    if (targetUnit.removed) {
      return invalid('Raise cannot target a removed unit');
    }
    if (targetUnit.vitals.hp > 0) {
      return invalid("Raise can only target a KO'd unit");
    }
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
    // Session 52: add the bow height-range bonus when the shooter is
    // above the target (no-op for non-bow / level / uphill shots).
    const unitHeightBonus = rangeFromHeightBonus(
      weaponRangeFromHeightSpec(actor, catalog, ability),
      offensiveSourceElevation,
      targetTile.elevation,
    );
    const inRangeOk = inRange({
      source: endpointFrom(actor.position, sourceTile.elevation),
      target: endpointFrom(targetUnit.position, targetTile.elevation),
      params: {
        horizontalMax: effectiveUnitRange.horizontal + unitHeightBonus,
        horizontalMin: effectiveUnitRange.minHorizontal ?? ruleset.rangeDefaults.minHorizontal,
        verticalMax: effectiveUnitRange.vertical,
      },
    });
    if (!inRangeOk) return invalid('Target is out of range');

    const rangeMode: RangeMode = ability.targeting.rangeMode;
    if (rangeMode === 'straight_line') {
      const losOk = hasLineOfSight(
        state.map,
        endpointFrom(actor.position, offensiveSourceElevation),
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
  // TABA M2: combinator gate — a locked Alchemist item can't be compounded.
  // `usableItems === undefined` ⇒ ungated (Mage War default).
  if (actor.usableItems !== undefined && !actor.usableItems.has(item.id)) {
    return invalid(`Item ${JSON.stringify(item.id)} is locked for this unit`);
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
  // TABA M2: combinator gate — a locked item can't be thrown either (a Field
  // Kit could stock an item the unit never unlocked). Ungated when undefined.
  if (actor.usableItems !== undefined && !actor.usableItems.has(item.id)) {
    return invalid(`Item ${JSON.stringify(item.id)} is locked for this unit`);
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
  // Airborne units (Dragoon Jump mid-leap, S62 / ADR-0103) are untargetable.
  if (targetUnit.airborne) {
    return invalid(`Target unit ${JSON.stringify(targetUnitId)} is airborne and cannot be targeted`);
  }
  // Revive consumables (Phoenix Down) target only KO'd units — classically a
  // downed unit to bring back, never a heal on a living one (ADR-0112: the
  // same rule as Raise). Other consumables (Potion / Ether / Remedy) still
  // target the living.
  if (item.effects.removeKO === true && targetUnit.vitals.hp > 0) {
    return invalid(`${item.name} can only target a KO'd unit`);
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
