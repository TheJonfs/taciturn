// Speed computation.
// See docs/design/ct-system.md and ADR-0004 (catalog injection) /
// ADR-0008 (ruleset surface).
//
// Computed on read, not stored. Pulls baseStats.spd through the
// modifyStatQuery hook chain so statuses (Haste, Slow), and eventually
// equipment, class traits, and equipped passives, can modify it. The
// speed floor (Stop, etc.) is read from the active ruleset's
// `speedBounds.floor` so an alternate ruleset can change it.

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../hooks/index.ts';
import { getUnit, type ChargedAction, type GameState, type UnitId } from '../types/index.ts';

export function computeSpeed(state: GameState, unitId: UnitId, catalog: Catalog): number {
  const unit = getUnit(state, unitId);
  const modified = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'spd',
    baseValue: unit.baseStats.spd,
  });
  const ruleset = catalog.getRuleset(state.ruleset.id);
  return Math.max(ruleset.speedBounds.floor, modified);
}

// Action Speed is stored on the ChargedAction (ADR-0003) and modified
// by abilities that mutate it directly (Hasten Charge, Slow Action).
// No hook chain at read time — the field is the canonical value.
// Floored against the same ruleset speed floor as unit Speed for
// consistency.
export function computeActionSpeed(
  state: GameState,
  action: ChargedAction,
  catalog: Catalog,
): number {
  const ruleset = catalog.getRuleset(state.ruleset.id);
  return Math.max(ruleset.speedBounds.floor, action.speed);
}
