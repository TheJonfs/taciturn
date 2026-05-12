// First demo battle. 6-unit asymmetric battle on a 6×6 ground-only map.
// Used by session 10's renderer to prove the engine end-to-end visibly.
//
// Session evolution:
//   - 10/11/12: 1v1 Knights (foundational rendering / UI / AI work).
//   - 13: 2v2 Knights + White Magic + Counter (smallest content change
//     that exercises bucket choice, MP gating, healing, and reactions).
//   - 17b: 4 units — Knight + Earth Mage per side (first non-Knight class).
//   - 18: 6 units — Knight + Earth Mage + Water Mage per side, mirror layout.
//   - 19: 6 units, *asymmetric* loadout — Team A keeps Knight + Water
//     Mage and gains Fire Mage; Team B keeps Earth Mage + Water Mage
//     and gains Fire Mage. Each side keeps a different non-Fire class.
//   - 20: 6 units, asymmetric — Team A: Knight + Water Mage + Lightning
//     Mage (drops Fire); Team B: Earth Mage + Fire Mage + Lightning
//     Mage (drops Water). Each non-Lightning class still has at least
//     one instance on the field. Both sides get Lightning to test
//     Static Embrace / Magnetic Mark / Storm Caller / Discharge /
//     Conductor across the table.
//
// Lives in `src/content/battles/` per the architecture overview's
// "BattleConfigs live in src/content/battles/" note.

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
// Second Action empty (per session 25: White Magic is hidden until the
// repertoire grows past Cure), Counter in the Reaction bucket, Move +1
// in Movement.
const KNIGHT_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('battle_skill'),
    [bucketId('second_action')]: null,
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('counter')],
    [bucketId('movement')]: [abilityId('move_plus_1')],
  },
};

// Earth Mage loadout (session 17b — first non-Knight class wired into
// the demo): Earth Spells on First Action (class-pinned), White Magic
// on Second Action so the mage has a backup tool, Earth Resilience in
// the Reaction bucket, Earth Communion in Support, Bedrock Stride in
// Movement (session 26.5: +1 moveRange + falling-damage immunity).
const EARTH_MAGE_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('earth_spells'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('earth_resilience')],
    [bucketId('support')]: [abilityId('earth_communion')],
    [bucketId('movement')]: [abilityId('bedrock_stride')],
  },
};

// Water Mage loadout (session 18 — second mage class wired into the
// demo): Water Spells on First Action (class-pinned), White Magic on
// Second Action for Cure backup, Tidal Pull in the Reaction bucket
// (self-CT bump on damage), Flow State in Support (CT refund on magic
// actions), Tidewalker in Movement (session 26.5: water-tile cost
// clamp; v1-marginal until elevated water-cost terrain ships).
const WATER_MAGE_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('water_spells'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('tidal_pull')],
    [bucketId('support')]: [abilityId('flow_state')],
    [bucketId('movement')]: [abilityId('tidewalker')],
  },
};

// Fire Mage loadout (session 19 — third mage class wired into the
// demo): Fire Spells on First Action (class-pinned), White Magic on
// Second Action for Cure backup, Smolder in the Reaction bucket
// (Burn-on-attacker), Ignition + Aether Bloom in Support (both free
// for Fire Mage — Burn-on-magical-damage and AoE expansion), Hotfoot
// in Movement (session 26.5: +1 moveRange + +1 spd).
const FIRE_MAGE_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('fire_spells'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('smolder')],
    [bucketId('support')]: [abilityId('ignition'), abilityId('aether_bloom')],
    [bucketId('movement')]: [abilityId('hotfoot')],
  },
};

// Lightning Mage loadout (session 20 — fourth mage class wired into the
// demo): Lightning Spells on First Action (class-pinned), White Magic
// on Second Action for Cure backup, Discharge in the Reaction bucket
// (free for Lightning Mage — magical retaliation), Conductor in
// Support (free — × 1.25 MA multiplier), Quickstep in Movement
// (session 26.5: onTurnEnd CT refund of +MA on Move-committed turns).
const LIGHTNING_MAGE_LOADOUT: UnitPlacement['loadout'] = {
  actionBuckets: {
    [bucketId('first_action')]: commandSetId('lightning_spells'),
    [bucketId('second_action')]: commandSetId('white_magic'),
  },
  passiveBuckets: {
    [bucketId('reaction')]: [abilityId('discharge')],
    [bucketId('support')]: [abilityId('conductor')],
    [bucketId('movement')]: [abilityId('quickstep')],
  },
};

// Post-reconciliation tuning (mage-war-content-spec, captured 2026-05-09):
// Brave / Faith default to 70 / 70 (Faith_factor 0.49 for symmetric
// magical interactions; Brave_factor 0.70). Reactions become probabilistic
// at Brave 70 — tests that needed deterministic triggers either override
// Brave to 100 explicitly or use seeded RNG (see audit report's test
// summary). All five classes carry the L25 stat targets from the spec.
//
// Session 28 (ADR-0058): `maxMpBase` joins `maxHpBase` as a stat-layer
// baseline. Knight 20 / Mages 60 per the spec. Placements omit explicit
// `vitals` and let `fillVitalsFromComputedMaxes` derive hp/mp from the
// computed maxHp / maxMp queries at battle start — so any equipment
// contribution (Wizard's Robe +40 MP, Staff of Abundance ×1.5 maxMp)
// composes through `modifyStatQuery` before vitals land.
//
// Session 20: all demo units carry the crit baseline (crit_chance: 5,
// crit_multiplier: 1.5) per ADR-0032. Lightning Mage's Static Embrace
// (Crit_modifier +20) layers additively on top.
const KNIGHT_BASE_STATS = {
  spd: 9,
  pa: 11,
  ma: 4,
  maxHpBase: 144,
  // 20 MP buys five Cures (mpCost 4 each).
  maxMpBase: 20,
  brave: 70,
  faith: 70,
  crit_chance: 5,
  crit_multiplier: 1.5,
} as const;

// Earth Mage L25 stats per the spec.
const MAGE_BASE_STATS = {
  spd: 8,
  pa: 4,
  ma: 12,
  maxHpBase: 112,
  maxMpBase: 60,
  brave: 70,
  faith: 70,
  crit_chance: 5,
  crit_multiplier: 1.5,
} as const;

// Water Mage L25 stats: fastest mage (Speed 10), HP 102.
const WATER_MAGE_BASE_STATS = {
  spd: 10,
  pa: 4,
  ma: 12,
  maxHpBase: 102,
  maxMpBase: 60,
  brave: 70,
  faith: 70,
  crit_chance: 5,
  crit_multiplier: 1.5,
} as const;

// Fire Mage L25 stats: glass-cannon profile — MA 13 (highest among
// non-Lightning mages), HP 97. At MA 13, Burn coefficient 0.6 → 7
// dmg/stack.
const FIRE_MAGE_BASE_STATS = {
  spd: 9,
  pa: 4,
  ma: 13,
  maxHpBase: 97,
  maxMpBase: 60,
  brave: 70,
  faith: 70,
  crit_chance: 5,
  crit_multiplier: 1.5,
} as const;

// Lightning Mage L25 stats: highest MA (14), lowest HP (87) — burst
// caster who folds before sustained pressure but brings extreme single-
// turn damage via Storm Caller (now ~247 raw at MA 14) and crit-stacked
// follow-ups via Static Embrace.
const LIGHTNING_MAGE_BASE_STATS = {
  spd: 9,
  pa: 4,
  ma: 14,
  maxHpBase: 87,
  maxMpBase: 60,
  brave: 70,
  faith: 70,
  crit_chance: 5,
  crit_multiplier: 1.5,
} as const;

export const demoBattle: BattleConfig = {
  battleId: 'demo_asymmetric',
  rulesetId: rulesetId('default'),
  map: buildFlatGround(),
  teams: [
    { id: TEAM_A, name: 'Blue' },
    { id: TEAM_B, name: 'Red' },
  ],
  // Session 19: Asymmetric loadouts so each side keeps a different
  // non-Fire class. Team A keeps Knight + Water Mage and adds Fire
  // Mage (drops Earth Mage); Team B keeps Earth Mage + Water Mage and
  // adds Fire Mage (drops Knight). Each non-Fire class still has at
  // least one instance on the field so its tools see use.
  units: [
    {
      id: unitId('blue_knight_n'),
      name: 'Blue Knight',
      team: TEAM_A,
      classId: classId('knight'),
      position: { x: 2, y: 2, layer: 0 },
      facing: 'E',
      baseStats: KNIGHT_BASE_STATS,
      loadout: KNIGHT_LOADOUT,
      equipment: KNIGHT_EQUIPMENT,
    },
    {
      id: unitId('blue_water_mage'),
      name: 'Blue Water Mage',
      team: TEAM_A,
      classId: classId('water_mage'),
      position: { x: 1, y: 4, layer: 0 },
      facing: 'E',
      baseStats: WATER_MAGE_BASE_STATS,
      loadout: WATER_MAGE_LOADOUT,
    },
    {
      id: unitId('blue_lightning_mage'),
      name: 'Blue Lightning Mage',
      team: TEAM_A,
      classId: classId('lightning_mage'),
      position: { x: 0, y: 3, layer: 0 },
      facing: 'E',
      baseStats: LIGHTNING_MAGE_BASE_STATS,
      loadout: LIGHTNING_MAGE_LOADOUT,
    },
    {
      id: unitId('red_earth_mage'),
      name: 'Red Earth Mage',
      team: TEAM_B,
      classId: classId('earth_mage'),
      position: { x: 5, y: 2, layer: 0 },
      facing: 'W',
      baseStats: MAGE_BASE_STATS,
      loadout: EARTH_MAGE_LOADOUT,
    },
    {
      id: unitId('red_lightning_mage'),
      name: 'Red Lightning Mage',
      team: TEAM_B,
      classId: classId('lightning_mage'),
      position: { x: 4, y: 1, layer: 0 },
      facing: 'W',
      baseStats: LIGHTNING_MAGE_BASE_STATS,
      loadout: LIGHTNING_MAGE_LOADOUT,
    },
    {
      id: unitId('red_fire_mage'),
      name: 'Red Fire Mage',
      team: TEAM_B,
      classId: classId('fire_mage'),
      position: { x: 3, y: 3, layer: 0 },
      facing: 'W',
      baseStats: FIRE_MAGE_BASE_STATS,
      loadout: FIRE_MAGE_LOADOUT,
    },
  ],
  victoryConditions: [
    { kind: 'defeat_all', side: TEAM_B, description: 'Defeat all enemies' },
    { kind: 'defeat_all', side: TEAM_A, description: 'Defeat all enemies' },
  ],
  masterSeed: 0xDEC0DE,
};
