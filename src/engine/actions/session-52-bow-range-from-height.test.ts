// Session 52 — bow horizontal range-from-height.
//
// FFT-canon "shoot farther from the high ground": a ranged weapon with
// `rangeFromHeightBonus: { perDeltaVertical, deltaHorizontal }` gains
// horizontal range when the shooter sits above the target —
// `floor((shooterElev - targetElev) / perDeltaVertical) × deltaHorizontal`,
// positive-only. Resolved per-target (it reads the target's elevation)
// at every in-range site, mirroring the ADR-0083 height-delta *damage*
// resolver. The two height rewards stack: high ground hits harder
// (variance) AND farther (this).
//
// Coverage:
//   1. The pure resolver (`rangeFromHeightBonus` / `maxRangeFromHeightBonus`
//      / `weaponRangeFromHeightSpec`) — formula, floor, directionality, gating.
//   2. Live-engine reach (`validateAction`) — a downhill bow shot reaches
//      past the base max; level / uphill / melee do not.
//   3. AI parity (`_basicAiInternals.targetIsInAbilityRange` /
//      `tilesInAbilityRange`) — AI enumeration agrees with the engine and
//      widens its candidate box for the extended reach.

import { describe, expect, it } from 'vitest';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { makeKnight } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  rangeFromHeightBonus,
  maxRangeFromHeightBonus,
  weaponRangeFromHeightSpec,
} from '../abilities/range-height.ts';
import { validateAction } from './validate.ts';
import {
  abilityId,
  bucketId,
  itemId,
  unitId,
  type GameState,
  type Tile,
  type UnitEquipment,
} from '../types/index.ts';
import type { ActiveAbilityDefinition, WeaponEquipment } from '../catalog/index.ts';
import { _basicAiInternals } from '../../ai/basic.ts';

// A bow with the S52 field: base range 2-5, +1 horizontal per 2 down.
const bow: WeaponEquipment = {
  id: itemId('h52_bow'),
  name: 'H52 Bow',
  availability: 'hidden',
  kind: 'weapon',
  wp: 7,
  accuracy: 33,
  tags: ['weapon', 'bow'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
};

// A melee weapon — no range fork, no height bonus.
const sword: WeaponEquipment = {
  id: itemId('h52_sword'),
  name: 'H52 Sword',
  availability: 'hidden',
  kind: 'weapon',
  wp: 5,
  accuracy: 95,
  tags: ['weapon', 'sword'],
};

// Weapon-tagged physical attack (like the universal Attack).
const weaponAttack: ActiveAbilityDefinition = {
  id: abilityId('h52_attack'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: { accuracy: 100 },
  effects: { damage: { tags: ['physical', 'weapon'], power_coefficient: 1 } },
};

// A non-weapon (magical) ability — must never get a height-range bonus.
const spell: ActiveAbilityDefinition = {
  id: abilityId('h52_spell'),
  name: 'Spell',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: { kind: 'unit_or_tile', range: { horizontal: 4, vertical: 99 }, rangeMode: 'arc' },
  actionSpeed: 0,
  mpCost: 0,
  effects: { damage: { tags: ['magical'], power_coefficient: 8 } },
};

function equipRight(id: string): UnitEquipment {
  return { leftHand: null, rightHand: itemId(id), headgear: null, armor: null, accessory: null };
}

const cat = createCatalog({
  statusTypes: [],
  abilities: [weaponAttack, spell],
  commandSets: [],
  classes: [makeKnight()],
  items: [bow, sword],
  rulesets: defaultTestRulesets,
});

// A 1×width row; tile x sits at the elevation given by `elevAt(x)`.
function rowMap(width: number, elevAt: (x: number) => number): GameState['map'] {
  const tiles: Tile[] = [];
  for (let x = 0; x < width; x++) {
    tiles.push({ x, y: 0, layer: 0, elevation: elevAt(x), terrain: 'ground', properties: [] });
  }
  return { width, height: 1, tiles };
}

// ===========================================================================
// 1. Pure resolver
// ===========================================================================

describe('S52 range-from-height — formula', () => {
  const spec = { perDeltaVertical: 2, deltaHorizontal: 1 };

  it('same elevation → +0', () => {
    expect(rangeFromHeightBonus(spec, 3, 3)).toBe(0);
  });

  it('shooter 6 above target 0 → +3 (floor(6/2))', () => {
    expect(rangeFromHeightBonus(spec, 6, 0)).toBe(3);
  });

  it('shooter 5 above target 1 → +2 (floor(4/2))', () => {
    expect(rangeFromHeightBonus(spec, 5, 1)).toBe(2);
  });

  it('floors partial deltas — shooter 5 above target 0 → +2 (floor(5/2))', () => {
    expect(rangeFromHeightBonus(spec, 5, 0)).toBe(2);
  });

  it('one tile of advantage is not enough — shooter 1 above target 0 → +0', () => {
    expect(rangeFromHeightBonus(spec, 1, 0)).toBe(0);
  });

  it('shooting uphill grants no bonus and no penalty', () => {
    expect(rangeFromHeightBonus(spec, 0, 6)).toBe(0);
    expect(rangeFromHeightBonus(spec, 1, 5)).toBe(0);
  });

  it('absent spec → +0', () => {
    expect(rangeFromHeightBonus(undefined, 6, 0)).toBe(0);
  });

  it('maxRangeFromHeightBonus is the bonus vs an elev-0 target', () => {
    expect(maxRangeFromHeightBonus(spec, 6)).toBe(3);
    expect(maxRangeFromHeightBonus(spec, 0)).toBe(0);
    expect(maxRangeFromHeightBonus(undefined, 6)).toBe(0);
  });
});

describe('S52 range-from-height — weapon spec gating', () => {
  const onPeak = makeUnit({ id: 'a', spd: 9, position: { x: 0, y: 0, layer: 0 } });

  it('weapon-tagged physical attack + bow → returns the spec', () => {
    const u = { ...onPeak, equipment: equipRight('h52_bow') };
    expect(weaponRangeFromHeightSpec(u, cat, weaponAttack)).toEqual({
      perDeltaVertical: 2,
      deltaHorizontal: 1,
    });
  });

  it('melee weapon without the field → undefined', () => {
    const u = { ...onPeak, equipment: equipRight('h52_sword') };
    expect(weaponRangeFromHeightSpec(u, cat, weaponAttack)).toBeUndefined();
  });

  it('non-weapon (magical) ability → undefined even with a bow equipped', () => {
    const u = { ...onPeak, equipment: equipRight('h52_bow') };
    expect(weaponRangeFromHeightSpec(u, cat, spell)).toBeUndefined();
  });
});

// ===========================================================================
// 2. Live-engine reach (validateAction)
// ===========================================================================

describe('S52 range-from-height — live validation reach', () => {
  // Attacker at (0,0); enemy target at (dist, 0). Manhattan distance = dist.
  function reachOk(args: {
    shooterElev: number;
    targetElev: number;
    dist: number;
    weapon: string;
  }): boolean {
    const attacker = makeUnit({
      id: 'a',
      spd: 9,
      pa: 6,
      position: { x: 0, y: 0, layer: 0 },
      equipment: equipRight(args.weapon),
    });
    const target = makeUnit({ id: 'b', spd: 9, team: 'team_b', position: { x: args.dist, y: 0, layer: 0 } });
    const map = rowMap(args.dist + 1, (x) => (x === 0 ? args.shooterElev : x === args.dist ? args.targetElev : 1));
    const state = makeGameState({
      units: [attacker, target],
      map,
      turnState: activeTurnFor(attacker.id),
    });
    const action = {
      type: 'use_ability' as const,
      source: 'player' as const,
      actorId: unitId('a'),
      payload: { abilityId: abilityId('h52_attack'), target: { kind: 'unit' as const, unitId: unitId('b') } },
      sequenceNumber: 0,
      seed: 1,
      timestamp: { tick: 0, ct: 0 },
      chainDepth: 0,
      isReaction: false,
    };
    return validateAction(state, action, cat).valid;
  }

  it('base reach unchanged at equal elevation (dist 5 in, dist 6 out)', () => {
    expect(reachOk({ shooterElev: 1, targetElev: 1, dist: 5, weapon: 'h52_bow' })).toBe(true);
    expect(reachOk({ shooterElev: 1, targetElev: 1, dist: 6, weapon: 'h52_bow' })).toBe(false);
  });

  it('shooting from elev 6 at an elev-0 target gains +3 range (reaches dist 8)', () => {
    expect(reachOk({ shooterElev: 6, targetElev: 0, dist: 8, weapon: 'h52_bow' })).toBe(true);
    // +3 is the cap for this delta — dist 9 is still out.
    expect(reachOk({ shooterElev: 6, targetElev: 0, dist: 9, weapon: 'h52_bow' })).toBe(false);
  });

  it('floors the bonus — elev 5 vs elev 0 gives +2 (reaches 7, not 8)', () => {
    expect(reachOk({ shooterElev: 5, targetElev: 0, dist: 7, weapon: 'h52_bow' })).toBe(true);
    expect(reachOk({ shooterElev: 5, targetElev: 0, dist: 8, weapon: 'h52_bow' })).toBe(false);
  });

  it('no bonus shooting uphill — elev 0 at an elev-6 target stays at base range', () => {
    expect(reachOk({ shooterElev: 0, targetElev: 6, dist: 6, weapon: 'h52_bow' })).toBe(false);
    expect(reachOk({ shooterElev: 0, targetElev: 6, dist: 5, weapon: 'h52_bow' })).toBe(true);
  });

  it('directionality: same dist 6, downhill reaches but uphill does not', () => {
    expect(reachOk({ shooterElev: 6, targetElev: 0, dist: 6, weapon: 'h52_bow' })).toBe(true);
    expect(reachOk({ shooterElev: 0, targetElev: 6, dist: 6, weapon: 'h52_bow' })).toBe(false);
  });

  it('a melee weapon gets no range fork and no height bonus (out of range at dist 2)', () => {
    expect(reachOk({ shooterElev: 6, targetElev: 0, dist: 2, weapon: 'h52_sword' })).toBe(false);
  });
});

// ===========================================================================
// 3. AI parity
// ===========================================================================

describe('S52 range-from-height — AI enumeration parity', () => {
  function setup(shooterElev: number, targetElev: number, dist: number) {
    const attacker = makeUnit({
      id: 'a',
      spd: 9,
      pa: 6,
      position: { x: 0, y: 0, layer: 0 },
      equipment: equipRight('h52_bow'),
    });
    const target = makeUnit({ id: 'b', spd: 9, team: 'team_b', position: { x: dist, y: 0, layer: 0 } });
    const map = rowMap(dist + 1, (x) => (x === 0 ? shooterElev : x === dist ? targetElev : 1));
    const state = makeGameState({ units: [attacker, target], map });
    return { state, attacker, target };
  }

  it('targetIsInAbilityRange matches the engine: downhill reach at dist 8', () => {
    const { state, attacker, target } = setup(6, 0, 8);
    expect(
      _basicAiInternals.targetIsInAbilityRange(state, attacker, attacker.position, target, weaponAttack, cat),
    ).toBe(true);
  });

  it('targetIsInAbilityRange matches the engine: no uphill bonus at dist 8', () => {
    const { state, attacker, target } = setup(0, 6, 8);
    expect(
      _basicAiInternals.targetIsInAbilityRange(state, attacker, attacker.position, target, weaponAttack, cat),
    ).toBe(false);
  });

  it('tilesInAbilityRange widens its box to include the extended-reach tile', () => {
    // Shooter on an elev-6 perch enumerating downhill: the elev-0 tile at
    // horizontal distance 8 (beyond base max 5) must appear, because the
    // box is widened by maxRangeFromHeightBonus (+3).
    const { state, attacker } = setup(6, 0, 8);
    const tiles = _basicAiInternals.tilesInAbilityRange(state, attacker, attacker.position, weaponAttack, cat);
    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
    expect(keys.has('8,0')).toBe(true);
  });
});
