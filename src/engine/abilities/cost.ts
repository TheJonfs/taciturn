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
//
// Equipment / status / passive modifiers compose here when their
// owning sessions add their hook surfaces; that's an additive change
// inside this function (no caller migration).

import type { Catalog } from '../catalog/index.ts';
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
