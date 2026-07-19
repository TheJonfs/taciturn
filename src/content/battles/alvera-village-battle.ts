// Alvera Village battle — the Chapter 1 node-2 battlefield template (S96).
//
// Derives from `riverRidgeBattle` (the 5v5 roster, equipment, ruleset,
// masterSeed) and restages onto the 16×16 Alvera Village map. In campaign
// use the fold replaces the player slots with the deployed roster and
// re-skins the enemy slots with the node's generated lineup — the
// authored staging below supplies the POSITIONS those lineups stand on.
//
// Staging (zones per `alvera_village` → `default`): Blue defends the
// village from the east-west road, facing north; Red masses in the NW
// fields across the row-8 river — the assault comes over the fords (or
// the long dry way around the east bank).

import type {
  BattleConfig,
  Position,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { alveraVillage } from '../maps/alvera-village.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — the village road (cols 6-11, rows 10-11). Knight
  // center-front on the road; mages spread along it.
  [unitId('blue_knight_n'), { x: 8, y: 10, layer: 0 }],
  [unitId('blue_water_mage'), { x: 6, y: 11, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 10, y: 10, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 7, y: 10, layer: 0 }],
  [unitId('blue_earth_mage'), { x: 9, y: 11, layer: 0 }],
  // Red / team_b — the NW fields (cols 1-4, rows 4-6), south edge
  // forward (the river is the front line).
  [unitId('red_knight_s'), { x: 2, y: 6, layer: 0 }],
  [unitId('red_water_mage'), { x: 1, y: 5, layer: 0 }],
  [unitId('red_fire_mage'), { x: 3, y: 6, layer: 0 }],
  [unitId('red_lightning_mage'), { x: 2, y: 4, layer: 0 }],
  [unitId('red_earth_mage'), { x: 4, y: 5, layer: 0 }],
]);

export const alveraVillageBattle: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'alvera_village_v1',
  map: alveraVillage,
  units: riverRidgeBattle.units.map((u: UnitPlacement): UnitPlacement => {
    const position = STARTING_POSITIONS.get(u.id);
    if (position === undefined) {
      throw new Error(
        `alvera-village-battle: no Alvera Village staging for unit ${String(u.id)}`,
      );
    }
    return { ...u, position };
  }),
};
