// ID-based accessors per ADR-0002.
// Throw on unknown ID (programmer error); spatial accessors with meaningful
// "no entity here" answers land in session 4 alongside the map subsystem.

import type { ChargedAction } from './charged-action.ts';
import { UnknownEntityError } from './errors.ts';
import type { ChargedActionId, UnitId } from './ids.ts';
import type { GameState } from './game-state.ts';
import type { Unit } from './unit.ts';

export function getUnit(state: GameState, id: UnitId): Unit {
  const unit = state.units.get(id);
  if (unit === undefined) throw new UnknownEntityError('Unit', id);
  return unit;
}

export function getChargedAction(state: GameState, id: ChargedActionId): ChargedAction {
  const ca = state.chargedActions.find((entry) => entry.id === id);
  if (ca === undefined) throw new UnknownEntityError('ChargedAction', id);
  return ca;
}
