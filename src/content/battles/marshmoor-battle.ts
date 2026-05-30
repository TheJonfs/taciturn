// Marshmoor battle — Session 52's third authored scenario.
//
// Derives from `riverRidgeBattle` (10-unit 5v5 roster; equipment
// loadouts, ruleset, masterSeed) and restages onto the 16×16 Marshmoor
// wetlands map. Both sides deploy in opposite-corner 3×3 zones — Blue
// in the NE (cols 13-15, rows 0-2), Red in the SW (cols 0-2, rows
// 13-15) — 26 Manhattan tiles apart, the longest pre-engagement window
// of any v1 map.
//
// Equipment reuses River Ridge's unique-per-team compliant set (S36).
//
// Loader-interface stability: shape matches stonebridge-battle.ts /
// river-ridge-battle.ts so the team builder and battle setup screens
// swap between them by changing the imported BattleConfig only.
//
// Per `docs/maps/marshmoor.md`:
//   NE zone (Blue / team_a): cols 13-15, rows 0-2 (9 tiles)
//   SW zone (Red  / team_b): cols 0-2,   rows 13-15 (9 tiles)

import type {
  BattleConfig,
  Position,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { marshmoor } from '../maps/marshmoor.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

// Each side stages inside its corner zone, the melee anchor at the
// inner front (toward the central flats), mages behind. Blue's front
// corner is (13, 2); Red's is (2, 13).
const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — NE zone (cols 13-15, rows 0-2). Facing SW.
  [unitId('blue_knight_n'), { x: 13, y: 2, layer: 0 }],
  [unitId('blue_water_mage'), { x: 14, y: 2, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 13, y: 1, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 14, y: 1, layer: 0 }],
  [unitId('blue_earth_mage'), { x: 15, y: 1, layer: 0 }],
  // Red / team_b — SW zone (cols 0-2, rows 13-15). Facing NE.
  [unitId('red_knight_s'), { x: 2, y: 13, layer: 0 }],
  [unitId('red_water_mage'), { x: 1, y: 13, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 2, y: 14, layer: 0 }],
  [unitId('red_fire_mage'), { x: 1, y: 14, layer: 0 }],
  [unitId('red_earth_mage'), { x: 0, y: 14, layer: 0 }],
]);

export const marshmoorBattle: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'marshmoor_v1',
  map: marshmoor,
  units: riverRidgeBattle.units.map((u: UnitPlacement): UnitPlacement => {
    const position = STARTING_POSITIONS.get(u.id);
    if (position === undefined) {
      throw new Error(
        `marshmoor-battle: no Marshmoor staging for unit ${String(u.id)}`,
      );
    }
    return { ...u, position };
  }),
};
