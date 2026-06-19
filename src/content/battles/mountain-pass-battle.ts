// Mountain Pass battle — Session 70's fourth scenario and the first
// built on a split deployment config.
//
// Derives from `riverRidgeBattle` (the 5v5 Mage War roster, equipment,
// ruleset, masterSeed) and restages onto the 16×16 Mountain Pass map,
// exactly as marshmoor/stonebridge restaged river-ridge. The deployment
// layout is the `mountain_pass` split config (content/deployment):
//   Victim   (Blue / team_a): one NW-valley sub-zone (uncapped).
//   Ambusher (Red  / team_b): two SE-heights sub-zones — SW massif
//                             (cap 3) + NE edge (cap 2).
//
// The authored staging below is cap-respecting (3 Red on the SW massif,
// 2 on the NE edge) so the template is a valid deployment even before
// the deployment phase re-places anyone.

import type {
  BattleConfig,
  Position,
  UnitId,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import { mountainPass } from '../maps/mountain-pass.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';

const STARTING_POSITIONS: ReadonlyMap<UnitId, Position> = new Map([
  // Blue / team_a — victim, NW valley basin (elev 3-5).
  [unitId('blue_knight_n'), { x: 2, y: 2, layer: 0 }],
  [unitId('blue_water_mage'), { x: 1, y: 1, layer: 0 }],
  [unitId('blue_lightning_mage'), { x: 3, y: 1, layer: 0 }],
  [unitId('blue_fire_mage'), { x: 1, y: 2, layer: 0 }],
  [unitId('blue_earth_mage'), { x: 3, y: 2, layer: 0 }],
  // Red / team_b — ambusher. SW massif (cap 3): knight + 2 mages.
  [unitId('red_knight_s'), { x: 8, y: 13, layer: 0 }],
  [unitId('red_water_mage'), { x: 9, y: 13, layer: 0 }],
  [unitId('red_fire_mage'), { x: 8, y: 12, layer: 0 }],
  // NE edge (cap 2): 2 mages.
  [unitId('red_lightning_mage'), { x: 14, y: 11, layer: 0 }],
  [unitId('red_earth_mage'), { x: 15, y: 11, layer: 0 }],
]);

export const mountainPassBattle: BattleConfig = {
  ...riverRidgeBattle,
  battleId: 'mountain_pass_v1',
  map: mountainPass,
  units: riverRidgeBattle.units.map((u: UnitPlacement): UnitPlacement => {
    const position = STARTING_POSITIONS.get(u.id);
    if (position === undefined) {
      throw new Error(
        `mountain-pass-battle: no Mountain Pass staging for unit ${String(u.id)}`,
      );
    }
    return { ...u, position };
  }),
};
