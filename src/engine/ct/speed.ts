// Speed computation.
// See docs/design/ct-system.md and ADR-0004 (catalog injection).
//
// Computed on read, not stored. Pulls baseStats.spd through the
// modifyStatQuery hook chain so statuses (Haste, Slow), and eventually
// equipment, class traits, and equipped passives, can modify it.
// SPEED_FLOOR (0) clamps the result — Stop and similar effects floor
// the unit's effective Speed at zero.

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../hooks/index.ts';
import { getUnit, type ChargedAction, type GameState, type UnitId } from '../types/index.ts';
import { SPEED_FLOOR } from './constants.ts';

export function computeSpeed(state: GameState, unitId: UnitId, catalog: Catalog): number {
  const unit = getUnit(state, unitId);
  const modified = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'spd',
    baseValue: unit.baseStats.spd,
  });
  return Math.max(SPEED_FLOOR, modified);
}

// Action Speed is stored on the ChargedAction (ADR-0003) and modified
// by abilities that mutate it directly (Hasten Charge, Slow Action).
// No hook chain at read time — the field is the canonical value.
export function computeActionSpeed(_state: GameState, action: ChargedAction): number {
  return Math.max(SPEED_FLOOR, action.speed);
}
