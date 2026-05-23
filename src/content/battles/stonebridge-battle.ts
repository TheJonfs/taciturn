// Stonebridge battle — Session 47's second authored Mage War scenario.
//
// Derives from `riverRidgeBattle` (8-unit roster, equipment loadouts,
// ruleset, masterSeed) and restages onto the 16×16 Stonebridge map.
// Starting positions place each side at the front edge of its
// deployment zone — Blue at y=1, Red at y=14 — facing the central
// engagement.
//
// Equipment reuses River Ridge's unique-per-team compliant set (S36 —
// each team has at most one of any item). Cross-team duplication
// (Blue and Red running the same item) is permitted by the team
// builder's unique-*within*-team rule.
//
// Default scenario: symmetric race-to-seize. Both teams reach the
// central river crossing or the SE keep in roughly the same number of
// turns. Asymmetric siege variant (south team starts inside the
// building, north team at far edge) is documented in
// `docs/maps/stonebridge.md` but not implemented this session.
//
// Loader-interface stability: shape matches river-ridge-battle.ts so
// the team builder and battle setup screens swap between them by
// changing the imported BattleConfig only.
//
// Per `docs/maps/stonebridge.md`:
//   North zone (Blue / team_a): rows 0-1, cols 5-8 (8 tiles)
//   South zone (Red  / team_b): rows 14-15, cols 5-8 (8 tiles)

import type {
  BattleConfig,
  Position,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { stonebridge } from '../maps/stonebridge.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

// Front-line positions deploy at the inner edge of each zone facing
// the central engagement. Knight (melee) takes center-front; mages
// flank. Mirror layout for Red.
const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — north zone (rows 0-1).
  [unitId('blue_knight_n'), { x: 7, y: 1, layer: 0 }],
  [unitId('blue_water_mage'), { x: 5, y: 0, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 8, y: 0, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 6, y: 1, layer: 0 }],
  // Red / team_b — south zone (rows 14-15). Facing N.
  [unitId('red_earth_mage'), { x: 5, y: 15, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 8, y: 15, layer: 0 }],
  [unitId('red_fire_mage'), { x: 7, y: 14, layer: 0 }],
  [unitId('red_water_mage'), { x: 6, y: 15, layer: 0 }],
]);

export const stonebridgeBattle: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'stonebridge_v1',
  map: stonebridge,
  units: riverRidgeBattle.units.map((u: UnitPlacement): UnitPlacement => {
    const position = STARTING_POSITIONS.get(u.id);
    if (position === undefined) {
      throw new Error(
        `stonebridge-battle: no Stonebridge staging for unit ${String(u.id)}`,
      );
    }
    return { ...u, position };
  }),
};
