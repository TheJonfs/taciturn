// Per-character ability and command-set cost computation.
// See docs/design/ability-slots.md ("Validation and modification") and ADR-0007.
//
// Costs are *computed*, not stored — same pattern as Speed and the
// movement profile. The base cost lives on the ability/command-set
// definition; per-character modulations (class grants, equipment,
// statuses, traits) compose on top.
//
// v1 modulations:
// - **Class grant.** A class's `freeAbilities` set drops the cost of
//   listed abilities to 0 for units in that class. This is the design
//   doc's "cost-0 contextual modulation."
// - **MP cost (per ADR-0056 / Session 27).** Active abilities expose
//   their MP cost through `computeMpCost`, which runs the
//   `modifyMpCost` hook chain (multiplicative). Equipment contributors
//   like Staff of Power × 1.20 land here; statuses / passives compose
//   the same way. The chain output is rounded half-up and floored at 0.
//
// The bucket-cost helper `getCost` covers slot capacity (Movement /
// Reaction / Support buckets); MP cost is a separate accounting axis
// surfaced by `computeMpCost`.

import type { Catalog } from '../catalog/index.ts';
import { runModifyMpCost } from '../hooks/runners.ts';
import {
  getUnit,
  type AbilityId,
  type CommandSetId,
  type GameState,
  type UnitId,
} from '../types/index.ts';

export function getCost(
  state: GameState,
  unitId: UnitId,
  abilityId: AbilityId,
  catalog: Catalog,
): number {
  const unit = getUnit(state, unitId);
  const ability = catalog.getAbility(abilityId);
  const cls = catalog.getClass(unit.classState.currentClass);
  if (cls.freeAbilities.has(abilityId)) return 0;
  return ability.baseCost;
}

// Command-set cost is not currently modulated by class — v1 has no
// "free command set" mechanic distinct from First Action being class-
// pinned (which sidesteps cost accounting entirely). Function exists
// for symmetry with `getCost` and so callers don't have to pick which
// API to call based on what's in a bucket.
export function getCommandSetCost(
  _state: GameState,
  _unitId: UnitId,
  commandSetId: CommandSetId,
  catalog: Catalog,
): number {
  return catalog.getCommandSet(commandSetId).baseCost;
}

// MP cost — the chokepoint for "what does this caster pay to use this
// ability right now?" Reads `ability.mpCost`, threads it through the
// `modifyMpCost` chain (multiplicative; equipment / status / passive
// contributors fire against the caster's hooks), rounds half-up, floors
// at 0. The reducer's MP affordability check, the deduction, and any
// outcome that records `mpSpent` route through this single call.
//
// Free-ability short-circuit: when the caster's class declares the
// ability in `freeAbilities`, MP cost is 0 unconditionally — the chain
// does not fire. (Multiplying 0 by any factor is still 0, so the
// numeric result would be the same; the short-circuit just keeps the
// contributor surface honest about when its handlers are observable.)
export function computeMpCost(
  state: GameState,
  catalog: Catalog,
  unitId: UnitId,
  abilityId: AbilityId,
): number {
  const unit = getUnit(state, unitId);
  const ability = catalog.getAbility(abilityId);
  const cls = catalog.getClass(unit.classState.currentClass);
  if (cls.freeAbilities.has(abilityId)) return 0;
  if (ability.kind !== 'active') return 0;
  const modified = runModifyMpCost(state, catalog, {
    unit,
    ability,
    baseCost: ability.mpCost,
  });
  // Round half-up, floor at 0. Equipment can only multiply costs; the
  // floor protects against authoring mistakes (a negative multiplier
  // shouldn't refund MP) and matches the existing damage-pipeline
  // convention of clamping at 0 when a chain over-applies.
  return Math.max(0, Math.round(modified));
}
