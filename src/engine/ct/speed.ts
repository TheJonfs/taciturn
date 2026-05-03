// Speed computation.
// See docs/design/ct-system.md.
//
// Speed is computed on read, not stored, per CLAUDE.md ground rule 5.
// In session 1 the formula is just `max(SPEED_FLOOR, baseStats.spd)`:
// equipment, statuses, passives, and class traits do not exist yet.
//
// When the hook system lands (session 3), Speed will be the result of a
// `modifyStatQuery` hook chain seeded with the base value. The shape of
// this function does not change at that point — only its body.

import { getUnit, type ChargedAction, type GameState, type UnitId } from '../types/index.ts';
import { SPEED_FLOOR } from './constants.ts';

export function computeSpeed(state: GameState, unitId: UnitId): number {
  const unit = getUnit(state, unitId);
  return Math.max(SPEED_FLOOR, unit.baseStats.spd);
}

// Action Speed is stored on the ChargedAction (ADR-0003), so this is a
// trivial accessor today. It exists as a function so callers go through one
// surface for both unit and charged-action speed; when CT-affecting hooks
// land, Action-Speed-modifying abilities will route through here.
export function computeActionSpeed(_state: GameState, action: ChargedAction): number {
  return Math.max(SPEED_FLOOR, action.speed);
}
