// First demo battle. 2v2 Knights on a 6×6 ground-only map. Used by
// session 10's renderer to prove the engine end-to-end visibly; session
// 13 expanded it from 1v1 to 2v2 with White Magic on the Second Action
// bucket and Counter in the Reaction bucket — the smallest content
// change that exercises bucket choice, MP gating, healing through the
// damage pipeline, and reactions in actual play. Two `defeat_all`
// victory conditions (one per team) so whichever side reaches 0 HP
// first ends the battle.
//
// Lives in `src/content/battles/` per the architecture overview's
// "BattleConfigs live in src/content/battles/" note. This is the v1
// demo; richer battles ship as content alongside subsequent sessions.

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
  type UnitPlacement,
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

// Shared loadout for v1: Battle Skill on First Action (class-pinned),
// White Magic on Second Action (Cure), Counter in the Reaction bucket,
// Move +1 in Movement.
const KNIGHT_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('battle_skill'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('counter')],
    [bucketId('movement')]: [abilityId('move_plus_1')],
  },
};

// faith 80 is a v1 placeholder; produces Faith_factor = 0.64 for symmetric
// demo casts (visible Cure / status numbers without overwhelming damage).
// Realistic faith spreads across classes land with content/tuning passes
// in sessions 16+. brave 100 keeps Counter and other reaction triggers
// deterministic for testing.
const KNIGHT_BASE_STATS = { spd: 10, pa: 6, ma: 4, maxHpBase: 60, brave: 100, faith: 80 } as const;
// 10 MP is enough for two Cures (mpCost 4 each) with a little slack —
// gives the AI / player a real "do I save it?" call without making the
// resource trivially infinite.
const KNIGHT_VITALS = { hp: 60, mp: 10 } as const;

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
      id: unitId('blue_knight_n'),
      name: 'Blue Knight N',
      team: TEAM_A,
      classId: classId('knight'),
      position: { x: 1, y: 1, layer: 0 },
      facing: 'E',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
    },
    {
      id: unitId('blue_knight_s'),
      name: 'Blue Knight S',
      team: TEAM_A,
      classId: classId('knight'),
      position: { x: 1, y: 4, layer: 0 },
      facing: 'E',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
    },
    {
      id: unitId('red_knight_n'),
      name: 'Red Knight N',
      team: TEAM_B,
      classId: classId('knight'),
      position: { x: 4, y: 1, layer: 0 },
      facing: 'W',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
    },
    {
      id: unitId('red_knight_s'),
      name: 'Red Knight S',
      team: TEAM_B,
      classId: classId('knight'),
      position: { x: 4, y: 4, layer: 0 },
      facing: 'W',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
    },
  ],
  victoryConditions: [
    { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
    { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
  ],
  masterSeed: 0xDEC0DE,
};
