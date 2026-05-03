// First demo battle. Two Knights on a 6×6 ground-only map. Used by
// session 10's renderer to prove the engine end-to-end visibly. Two
// `defeat_all` victory conditions (one per team) so whichever side
// reaches 0 HP first ends the battle.
//
// Lives in `src/content/battles/` per the architecture overview's
// "BattleConfigs live in src/content/battles/" note. This is the v1
// demo; richer battles ship as content alongside session 13.

import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type BattleMap,
  type Tile,
} from '@engine/index.ts';

const MAP_WIDTH = 6;
const MAP_HEIGHT = 6;

function buildFlatGround(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: 0,
        terrain: 'ground',
        properties: [],
      });
    }
  }
  return { width: MAP_WIDTH, height: MAP_HEIGHT, tiles };
}

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

export const demoBattle: BattleConfig = {
  battleId: 'demo_two_knights',
  rulesetId: rulesetId('default'),
  map: buildFlatGround(),
  teams: [
    { id: TEAM_A, name: 'Blue' },
    { id: TEAM_B, name: 'Red' },
  ],
  units: [
    {
      id: unitId('blue_knight'),
      name: 'Blue Knight',
      team: TEAM_A,
      classId: classId('knight'),
      position: { x: 1, y: 3, layer: 0 },
      facing: 'E',
      baseStats: { spd: 10, pa: 6, ma: 4, maxHpBase: 60 },
      vitals: { hp: 60, mp: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: commandSetId('battle_skill') },
        passiveBuckets: { [bucketId('movement')]: [abilityId('move_plus_1')] },
      },
    },
    {
      id: unitId('red_knight'),
      name: 'Red Knight',
      team: TEAM_B,
      classId: classId('knight'),
      position: { x: 4, y: 3, layer: 0 },
      facing: 'W',
      baseStats: { spd: 10, pa: 6, ma: 4, maxHpBase: 60 },
      vitals: { hp: 60, mp: 0 },
      loadout: {
        actionBuckets: { [bucketId('first_action')]: commandSetId('battle_skill') },
        passiveBuckets: { [bucketId('movement')]: [abilityId('move_plus_1')] },
      },
    },
  ],
  victoryConditions: [
    { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
    { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
  ],
  masterSeed: 0xDEC0DE,
};
