// Movement profile composition.
// See docs/design/map-and-battlefield.md ("Movement profile") and
// ADR-0006 (composition rule).
//
// The unit's class supplies a baseline (moveRange, jump, terrainCosts,
// canEnter, optional specialMovement). The two scalar fields flow
// through `runModifyStatQuery` so statuses (and, later, equipment and
// passives) can stack modifiers — Move+1 / Jump+2 / Slow movement etc.
// The set/map fields and `specialMovement` come straight from the
// class today; their modifier hook lands with session 5 (passives).
//
// Pure function. Same `(state, unitId, catalog)` always yields the
// same profile (subject to whatever is in state — statuses, etc.).

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../status/index.ts';
import {
  getUnit,
  type GameState,
  type MovementProfile,
  type UnitId,
} from '../types/index.ts';

export function computeMovementProfile(
  state: GameState,
  unitId: UnitId,
  catalog: Catalog,
): MovementProfile {
  const unit = getUnit(state, unitId);
  const cls = catalog.getClass(unit.classState.currentClass);
  const baseline = cls.movement;

  const moveRange = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'moveRange',
    baseValue: baseline.moveRange,
  });
  const jump = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'jump',
    baseValue: baseline.jump,
  });

  return {
    moveRange,
    jump,
    terrainCosts: baseline.terrainCosts,
    canEnter: baseline.canEnter,
    ...(baseline.specialMovement !== undefined
      ? { specialMovement: baseline.specialMovement }
      : {}),
  };
}
