// River Ridge battle — the Phase D/E playable Mage War config.
//
// Derives from `demoBattle` (the 6-unit roster + loadouts + base stats
// + ruleset + masterSeed) and restages onto the 14×14 River Ridge map,
// then adds two River-Ridge-specific units for the 4v4 deployment demo.
// Blue (team_a) deploys in the northern zone (rows 0-2 cols 5-8); Red
// (team_b) deploys in the southern zone (rows 11-13 cols 5-8).
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
// Session 36: River Ridge's per-team loadouts are made **unique-per-
// team compliant** — each team carries at most one instance of any
// equipment item, the constraint the team builder enforces. Equipment
// is re-authored locally here (the `RIVER_RIDGE_EQUIPMENT` map) rather
// than reusing `demo.ts`'s shared constants, so `demoBattle` — the 3v3
// engine smoke-test fixture — stays byte-for-byte untouched. Loadouts
// and base stats are still reused from `demo.ts`; only `equipment` is
// overridden. Cross-team duplication is allowed (Blue and Red may each
// run a Wizard's Robe); the rule is unique *within* a team.
//
// Loader-interface stability: the BattleConfig shape stays identical
// to training-field-battle.ts — Phase E's team builder produces the
// Blue team's units, replacing the static authoring here for team_a.

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

// Session 36: unique-per-team compliant equipment, authored locally so
// `demoBattle` stays untouched. Each team's eight equipment slots draw
// from distinct items; the only repeats are cross-team (Blue and Red
// both run a Wizard's Robe / Battle Gear / Silvered Vest, which the
// unique-*within*-team rule permits).
//
// Adjustments from the prior (non-compliant) loadouts:
//   Blue Lightning Mage: Pointy Hat → Magus Crown
//   Blue Fire Mage:      Pointy Hat → Guard Cap, Wizard's Robe →
//                        Battle Gear, Flametongue → (none)
//   Red Lightning Mage:  Pointy Hat → Guard Cap, Wizard's Robe →
//                        Silvered Vest
//   Red Fire Mage:       Wizard's Robe → Battle Gear (Magus Crown
//                        stays — its +1 secondary-command-set capacity
//                        is load-bearing for this unit's loadout)
//   Red Water Mage:      Pointy Hat → Focus Band
const RIVER_RIDGE_EQUIPMENT: ReadonlyMap<UnitId, UnitEquipment> = new Map([
  [
    unitId('blue_knight_n'),
    {
      leftHand: itemId('managuard'),
      rightHand: itemId('bolt_hammer'),
      headgear: itemId('focus_band'),
      armor: itemId('silvered_vest'),
      accessory: itemId('tintinibar'),
    },
  ],
  [
    unitId('blue_water_mage'),
    {
      leftHand: null,
      rightHand: itemId('wand_of_depths'),
      headgear: itemId('pointy_hat'),
      armor: itemId('sorcerers_robe'),
      accessory: itemId('lightfoot'),
    },
  ],
  [
    unitId('blue_lightning_mage'),
    {
      leftHand: null,
      rightHand: itemId('flametongue'),
      headgear: itemId('magus_crown'),
      armor: itemId('wizards_robe'),
      accessory: itemId('rasp_pendant'),
    },
  ],
  [
    unitId('blue_fire_mage'),
    {
      leftHand: null,
      rightHand: null,
      headgear: itemId('guard_cap'),
      armor: itemId('battle_gear'),
      accessory: null,
    },
  ],
  [
    unitId('red_earth_mage'),
    {
      leftHand: null,
      rightHand: itemId('wand_of_deepwood'),
      headgear: itemId('pointy_hat'),
      armor: itemId('wizards_robe'),
      accessory: itemId('capacitor_ring'),
    },
  ],
  [
    unitId('red_lightning_mage'),
    {
      leftHand: null,
      rightHand: itemId('staff_of_power'),
      headgear: itemId('guard_cap'),
      armor: itemId('silvered_vest'),
      accessory: itemId('purifier'),
    },
  ],
  [
    unitId('red_fire_mage'),
    {
      leftHand: null,
      rightHand: null,
      headgear: itemId('magus_crown'),
      armor: itemId('battle_gear'),
      accessory: null,
    },
  ],
  [
    unitId('red_water_mage'),
    {
      leftHand: null,
      rightHand: itemId('wand_of_depths'),
      headgear: itemId('focus_band'),
      armor: itemId('sorcerers_robe'),
      accessory: itemId('lightfoot'),
    },
  ],
]);

// Session 35: River Ridge expands to 4v4 (the deployment-phase UI
// places four Blue units). The two extra units live here rather than
// in `demoBattle` so the 3v3 engine smoke-test fixture — consumed by
// `orchestrator.test.ts` and `ai-controller.integration.test.ts` on
// the 6×6 map — is untouched. Loadouts / stats reuse the shared
// constants from `demo.ts`; equipment comes from `RIVER_RIDGE_EQUIPMENT`.
const blueFireMage: UnitPlacement = {
  id: unitId('blue_fire_mage'),
  name: 'Blue Fire Mage',
  team: teamId('team_a'),
  classId: classId('fire_mage'),
  position: STARTING_POSITIONS.get(unitId('blue_fire_mage'))!,
  facing: 'S',
  baseStats: FIRE_MAGE_BASE_STATS,
  loadout: FIRE_MAGE_LOADOUT,
  equipment: RIVER_RIDGE_EQUIPMENT.get(unitId('blue_fire_mage'))!,
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
  equipment: RIVER_RIDGE_EQUIPMENT.get(unitId('red_water_mage'))!,
};

export const riverRidgeBattle: BattleConfig = {
  ...demoBattle,
  battleId: 'river_ridge_v1',
  map: riverRidge,
  units: [
    ...demoBattle.units.map((u) => {
      // Every demo unit restaged on River Ridge has an entry in both
      // tables; a miss is an authoring error, not a fall-back case.
      const position = STARTING_POSITIONS.get(u.id);
      const equipment = RIVER_RIDGE_EQUIPMENT.get(u.id);
      if (position === undefined || equipment === undefined) {
        throw new Error(
          `river-ridge-battle: no River Ridge staging for unit ${String(u.id)}`,
        );
      }
      return { ...u, position, equipment };
    }),
    blueFireMage,
    redWaterMage,
  ],
};
