// River Ridge battle — the Phase D playable Mage War config.
//
// Mirrors `training-field-battle.ts`'s shape: derives from `demoBattle`
// (the 6-unit roster + loadouts + equipment + ruleset + masterSeed) and
// restages onto the 14×14 River Ridge map. Blue (team_a) deploys in
// the northern zone (rows 0-2 cols 5-8); Red (team_b) deploys in the
// southern zone (rows 11-13 cols 5-8).
//
// Starting positions intentionally use the front-edge rows of each
// zone (Blue at row 2, Red at row 11) so the units enter the central
// engagement zone quickly. Mages spread to the flanks so the ridge,
// the river, and the ranged perches all factor into the first few
// turns rather than the units bunching at center.
//
// Session 33 (river-ridge.md + ADR-0073): exercises jump-over-water at
// col 0 ↔ col 2 via col 1's water gaps, water_shallow / water_deep
// terrain cost split, Tidewalker reduction on the Water Mage, knockback
// fall-damage off the ridge, and the cliff-edge rendering layer.
//
// Loader-interface stability: the BattleConfig shape stays identical
// to training-field-battle.ts — Phase E's team-builder will eventually
// produce these objects directly, replacing the static authoring here.

import type {
  BattleConfig,
  Position,
  UnitEquipment,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { classId, itemId, teamId, unitId } from '@engine/index.ts';
import { riverRidge } from '../maps/river-ridge.ts';
import {
  demoBattle,
  FIRE_MAGE_BASE_STATS,
  FIRE_MAGE_LOADOUT,
  WATER_MAGE_BASE_STATS,
  WATER_MAGE_EQUIPMENT,
  WATER_MAGE_LOADOUT,
} from './demo.ts';

// Per `docs/twentyOneDesign/river-ridge.md`:
//   Blue zone: rows 0-2, cols 5-8 (12 tiles)
//   Red zone:  rows 11-13, cols 5-8 (12 tiles)
//
// Front-line positions deploy at the zone edges facing the central
// engagement; back-line positions hug the spawn edge. Blue at row 2
// (front of north zone) and Red at row 11 (front of south zone) so
// both sides reach the ridge in roughly the same turn count.
const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — north zone.
  // Knight (melee) takes the center-front; mages flank.
  [unitId('blue_knight_n'), { x: 7, y: 2, layer: 0 }],
  [unitId('blue_water_mage'), { x: 5, y: 1, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 8, y: 1, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 6, y: 2, layer: 0 }],
  // Red / team_b — south zone.
  // Mirror layout — Fire mage center-front, Earth + Lightning flank.
  [unitId('red_earth_mage'), { x: 5, y: 12, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 8, y: 12, layer: 0 }],
  [unitId('red_fire_mage'), { x: 7, y: 11, layer: 0 }],
  [unitId('red_water_mage'), { x: 6, y: 12, layer: 0 }],
]);

// Session 35: River Ridge expands to 4v4 (the deployment-phase UI
// places four Blue units). The two extra units live here rather than
// in `demoBattle` so the 3v3 engine smoke-test fixture — consumed by
// `orchestrator.test.ts` and `ai-controller.integration.test.ts` on
// the 6×6 map — is untouched. Loadouts / stats reuse the shared
// constants from `demo.ts`; equipment is team-blind catalog data.

// Blue Fire Mage equipment: Flametongue + Wizard's Robe + Pointy Hat.
// Flametongue's Burn proc is thematically a Fire Mage's tool; the
// Wizard's Robe MA boost / broad elemental vulnerability matches the
// other Blue mages' glass-cannon profile.
const BLUE_FIRE_MAGE_EQUIPMENT: UnitEquipment = {
  leftHand: null,
  rightHand: itemId('flametongue'),
  headgear: itemId('pointy_hat'),
  armor: itemId('wizards_robe'),
  accessory: null,
};

const blueFireMage: UnitPlacement = {
  id: unitId('blue_fire_mage'),
  name: 'Blue Fire Mage',
  team: teamId('team_a'),
  classId: classId('fire_mage'),
  position: STARTING_POSITIONS.get(unitId('blue_fire_mage'))!,
  facing: 'S',
  baseStats: FIRE_MAGE_BASE_STATS,
  loadout: FIRE_MAGE_LOADOUT,
  equipment: BLUE_FIRE_MAGE_EQUIPMENT,
};

const redWaterMage: UnitPlacement = {
  id: unitId('red_water_mage'),
  name: 'Red Water Mage',
  team: teamId('team_b'),
  classId: classId('water_mage'),
  position: STARTING_POSITIONS.get(unitId('red_water_mage'))!,
  facing: 'N',
  baseStats: WATER_MAGE_BASE_STATS,
  loadout: WATER_MAGE_LOADOUT,
  equipment: WATER_MAGE_EQUIPMENT,
};

export const riverRidgeBattle: BattleConfig = {
  ...demoBattle,
  battleId: 'river_ridge_v1',
  map: riverRidge,
  units: [
    ...demoBattle.units.map((u) => {
      const next = STARTING_POSITIONS.get(u.id);
      return next === undefined ? u : { ...u, position: next };
    }),
    blueFireMage,
    redWaterMage,
  ],
};
