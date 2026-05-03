// Movement profile composition.
// See docs/design/map-and-battlefield.md ("Movement profile") and
// ADR-0006 (composition rule).
//
// The unit's class supplies a baseline (moveRange, jump, terrainCosts,
// canEnter, optional specialMovement). Each field flows through its
// dedicated hook chain so statuses, equipment, passives, and class
// traits can stack modifiers — Move+1 / Jump+2 (modifyStatQuery),
// Float (modifyCanEnter), Fly (modifySpecialMovement), and so on.
//
// Pure function. Same `(state, unitId, catalog)` always yields the
// same profile (subject to whatever is in state — statuses, equipped
// passives, etc.).

import type { Catalog } from '../catalog/index.ts';
import {
  runModifyCanEnter,
  runModifySpecialMovement,
  runModifyStatQuery,
  runModifyTerrainCosts,
} from '../hooks/index.ts';
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
  const canEnter = runModifyCanEnter(state, catalog, {
    unit,
    baseValue: baseline.canEnter,
  });
  const terrainCosts = runModifyTerrainCosts(state, catalog, {
    unit,
    baseValue: baseline.terrainCosts,
  });
  const specialMovement = runModifySpecialMovement(state, catalog, {
    unit,
    baseValue: baseline.specialMovement,
  });

  return {
    moveRange,
    jump,
    terrainCosts,
    canEnter,
    ...(specialMovement !== undefined ? { specialMovement } : {}),
  };
}
