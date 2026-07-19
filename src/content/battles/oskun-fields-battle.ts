// Oskun Fields battle — the Chapter 1 node-1 battlefield template (S96).
//
// Derives from `riverRidgeBattle` (the 5v5 roster, equipment, ruleset,
// masterSeed) and restages onto the 16×16 Oskun Fields map, exactly as
// mountain-pass/marshmoor/stonebridge restaged before it. In campaign
// use the fold replaces the player slots with the deployed roster and
// re-skins the enemy slots with the node's generated lineup — the
// authored staging below supplies the POSITIONS those lineups stand on.
//
// Staging (zones per `oskun_fields` → `default`): Blue on the west-bank
// fields facing east; Red on the eastern knolls facing west — first
// contact happens across the wadeable col-7 stream. The Ch1 beat adds
// Wiegraf's guest slot beside the player zone in node-content.ts.

import type {
  BattleConfig,
  Position,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { oskunFields } from '../maps/oskun-fields.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — west bank (cols 3-5, rows 4-7). Knight fronts the
  // stream crossing; mages stagger behind on the rising ground.
  [unitId('blue_knight_n'), { x: 5, y: 6, layer: 0 }],
  [unitId('blue_water_mage'), { x: 3, y: 5, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 5, y: 4, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 4, y: 5, layer: 0 }],
  [unitId('blue_earth_mage'), { x: 3, y: 6, layer: 0 }],
  // Red / team_b — eastern knolls (cols 9-11, rows 4-7). Knight fronts
  // the west edge; mages hold the elev-4/5 rise.
  [unitId('red_knight_s'), { x: 9, y: 6, layer: 0 }],
  [unitId('red_water_mage'), { x: 10, y: 5, layer: 0 }],
  [unitId('red_fire_mage'), { x: 9, y: 5, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 10, y: 6, layer: 0 }],
  [unitId('red_earth_mage'), { x: 11, y: 6, layer: 0 }],
]);

export const oskunFieldsBattle: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'oskun_fields_v1',
  map: oskunFields,
  units: riverRidgeBattle.units.map((u: UnitPlacement): UnitPlacement => {
    const position = STARTING_POSITIONS.get(u.id);
    if (position === undefined) {
      throw new Error(
        `oskun-fields-battle: no Oskun Fields staging for unit ${String(u.id)}`,
      );
    }
    return { ...u, position };
  }),
};
