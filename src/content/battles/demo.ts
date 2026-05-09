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
  itemId,
  rulesetId,
  teamId,
  unitId,
  type BattleConfig,
  type BattleMap,
  type Tile,
  type UnitEquipment,
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

// Knight equipment: Long Sword in the right hand for v1 (per
// ADR-0028). Headgear / armor / accessory slots stay open in the demo
// so equipment integration is exercised without changing the demo's
// damage tuning. WP=4 from the long_sword × power_coefficient=1.0 from
// the basic Attack ability reproduces the prior demo damage exactly.
const KNIGHT_EQUIPMENT: UnitEquipment = {
  leftHand: null,
  rightHand: itemId('long_sword'),
  headgear: null,
  armor: null,
  accessory: null,
};

// Knight loadout: Battle Skill on First Action (class-pinned),
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

// Earth Mage loadout (session 17b — first non-Knight class wired into
// the demo): Earth Spells on First Action (class-pinned), White Magic
// on Second Action so the mage has a backup tool, Earth Resilience in
// the Reaction bucket, Earth Communion in Support, Move +1 in Movement.
const EARTH_MAGE_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('earth_spells'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('earth_resilience')],
    [bucketId('support')]: [abilityId('earth_communion')],
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

// Earth Mage stats: lower HP, lower PA, higher MA than Knight; speed
// roughly comparable. The mage's identity is "stays-back caster," and
// the lower HP plus higher MP exercise that. 40 MP buys one Earth
// Cataclysm (mpCost 30) plus an Earth Strike (mpCost 4); generous on
// purpose so Cataclysm gets seen across plays.
const MAGE_BASE_STATS = { spd: 9, pa: 4, ma: 8, maxHpBase: 50, brave: 100, faith: 80 } as const;
const MAGE_VITALS = { hp: 50, mp: 40 } as const;

export const demoBattle: BattleConfig = {
  battleId: 'demo_knight_earth_mage',
  rulesetId: rulesetId('default'),
  map: buildFlatGround(),
  teams: [
    { id: TEAM_A, name: 'Blue' },
    { id: TEAM_B, name: 'Red' },
  ],
  // Session 17b: Knight + Earth Mage per side. The Knight occupies the
  // forward position (closer to the midline at column 2/3) so they meet
  // in melee; the Earth Mage sits in the back column (1/4) so charged
  // spells have a beat to land.
  units: [
    {
      id: unitId('blue_knight_n'),
      name: 'Blue Knight',
      team: TEAM_A,
      classId: classId('knight'),
      position: { x: 2, y: 2, layer: 0 },
      facing: 'E',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
      equipment: KNIGHT_EQUIPMENT,
    },
    {
      id: unitId('blue_earth_mage'),
      name: 'Blue Earth Mage',
      team: TEAM_A,
      classId: classId('earth_mage'),
      position: { x: 0, y: 3, layer: 0 },
      facing: 'E',
      baseStats: MAGE_BASE_STATS,
      vitals: MAGE_VITALS,
      loadout: EARTH_MAGE_LOADOUT,
    },
    {
      id: unitId('red_knight_n'),
      name: 'Red Knight',
      team: TEAM_B,
      classId: classId('knight'),
      position: { x: 3, y: 3, layer: 0 },
      facing: 'W',
      baseStats: KNIGHT_BASE_STATS,
      vitals: KNIGHT_VITALS,
      loadout: KNIGHT_LOADOUT,
      equipment: KNIGHT_EQUIPMENT,
    },
    {
      id: unitId('red_earth_mage'),
      name: 'Red Earth Mage',
      team: TEAM_B,
      classId: classId('earth_mage'),
      position: { x: 5, y: 2, layer: 0 },
      facing: 'W',
      baseStats: MAGE_BASE_STATS,
      vitals: MAGE_VITALS,
      loadout: EARTH_MAGE_LOADOUT,
    },
  ],
  victoryConditions: [
    { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
    { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
  ],
  masterSeed: 0xDEC0DE,
};
