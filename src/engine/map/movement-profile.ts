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
// Session 33 (ADR-0073): per the ruleset contract, the active ruleset's
// `pathfinding.defaultTerrainCosts` merges into the class baseline
// before the `modifyTerrainCosts` chain fires (class overrides ruleset).
// The terrain tag registry (`ruleset.terrain.tags`) threads into the
// `modifyCanEnter` and `modifyTerrainCosts` hooks so handlers can key
// on tags rather than terrain literals.
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
  type TerrainType,
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
  const rulesetDefaults = catalog.getRuleset(state.ruleset.id).pathfinding.defaultTerrainCosts;

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
  // Merge ruleset defaults with class baseline; class entries override
  // ruleset entries for the same terrain. This honors the documented
  // contract on `RulesetPathfinding.defaultTerrainCosts` so authors can
  // declare "water_shallow = 2" once at the ruleset rather than in every
  // class baseline.
  const mergedBaseline = new Map<TerrainType, number>(rulesetDefaults);
  for (const [terrain, cost] of baseline.terrainCosts) {
    mergedBaseline.set(terrain, cost);
  }
  const terrainCosts = runModifyTerrainCosts(state, catalog, {
    unit,
    baseValue: mergedBaseline,
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
