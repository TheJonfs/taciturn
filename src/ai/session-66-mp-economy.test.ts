// Session 66, chunk 2 — MP economy (D2: soft scaled penalty only, no hard
// floor). The unified scorer subtracts a scarcity-scaled penalty from an
// action's MP cost, so the AI conserves its last MP for marginal casts
// while a high-value cast still wins through the (bounded, subordinate)
// penalty. Its mirror: an Ether throw is worth more as the recipient runs
// dry.
//
// Layers:
//   1. computeMaxMp / mpScarcity / mpSpendPenalty — the penalty primitives.
//   2. scoreSingleUnitOffensive — the penalty folds in; a marginal cast
//      flips below a free attack at low MP but not at full MP.
//   3. decideBasicAi — acceptance: (A) conserve on a marginal cast, (B)
//      still cast a high-value spell at low MP.
//   4. bestThrowCandidate — Ether restore-valuation rises as MP drops.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  itemId,
  teamId,
  type DamageTag,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { wandOfLumen } from '../content/items/wand-of-lumen.ts';
import { attack } from '../content/abilities/attack.ts';
import { fireStrike } from '../content/abilities/fire-strike.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const FIRE_SPELLS = commandSetId('fire_spells');
const ALCHEMY = commandSetId('alchemy');
const FIRE_STRIKE = abilityId('fire_strike');
const ATTACK = abilityId('attack');
const ETHER = itemId('ether');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function flatGround(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 0, terrain: 'ground', properties: [] });
    }
  }
  return tiles;
}

function plainUnit(mp: number, maxMpBase: number): Unit {
  return makeUnit({ id: 'u', spd: 10, classId: 'fire_mage', maxMpBase, mp, position: { x: 0, y: 0, layer: 0 } });
}

describe('S66 chunk 2 — MP penalty primitives', () => {
  const cat = loadDefaultCatalog();

  it('computeMaxMp reads the computed max (base when unequipped)', () => {
    expect(_basicAiInternals.computeMaxMp(makeGameState({
      units: [plainUnit(20, 40)], map: { width: 2, height: 2, tiles: flatGround(2, 2) }, teams: TEAMS,
    }), cat, plainUnit(20, 40))).toBe(40);
  });

  it('mpScarcity is 0 at full MP, 1 at empty, convex in between', () => {
    const s = (mp: number, max: number) => _basicAiInternals.mpScarcity(
      makeGameState({ units: [plainUnit(mp, max)], map: { width: 2, height: 2, tiles: flatGround(2, 2) }, teams: TEAMS }),
      cat, plainUnit(mp, max),
    );
    expect(s(40, 40)).toBe(0);          // full → no scarcity
    expect(s(0, 40)).toBe(1);           // empty → max scarcity
    expect(s(20, 40)).toBeCloseTo(0.25); // half → (1-0.5)² = 0.25 (convex, gentle)
  });

  it('mpSpendPenalty is 0 for a free ability and rises as MP drops for a real cast', () => {
    const mage = (mp: number) => makeUnit({
      id: 'mg', spd: 10, ma: 9, pa: 4, classId: 'fire_mage', maxMpBase: 48, mp,
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
      equipment: { leftHand: null, rightHand: wandOfLumen.id, headgear: null, armor: null, accessory: null },
    });
    const stateAt = (m: Unit) => makeGameState({
      units: [m], map: { width: 4, height: 4, tiles: flatGround(4, 4) }, teams: TEAMS, turnState: activeTurnFor(m.id),
    });
    // attack is a free ability for Fire Mage → never penalized, any MP.
    expect(_basicAiInternals.mpSpendPenalty(stateAt(mage(10)), cat, mage(10), attack)).toBe(0);
    // fire_strike (mpCost 10) → 0 at full MP, positive at low MP.
    expect(_basicAiInternals.mpSpendPenalty(stateAt(mage(48)), cat, mage(48), fireStrike)).toBe(0);
    // mpCost 10 × weight 1.5 × scarcity((1-10/48)²=0.6267) ≈ 9.40.
    expect(_basicAiInternals.mpSpendPenalty(stateAt(mage(10)), cat, mage(10), fireStrike)).toBeCloseTo(9.40, 1);
  });
});

describe('S66 chunk 2 — scoreSingleUnitOffensive folds the MP penalty', () => {
  const cat = loadDefaultCatalog();
  // Fire Mage with a wand, adjacent to an enemy with 70% fire resistance —
  // tuned so fire_strike is only marginally better than the wand attack.
  function setup(mp: number, fireResist: number) {
    const mage = makeUnit({
      id: 'mg', spd: 10, ma: 9, pa: 4, hp: 50, maxMpBase: 48, mp, classId: 'fire_mage',
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
      equipment: { leftHand: null, rightHand: wandOfLumen.id, headgear: null, armor: null, accessory: null },
    });
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 2, y: 1, layer: 0 }, facing: 'E',
      resistances: new Map<DamageTag, number>([['fire', fireResist]]),
    });
    const state = makeGameState({
      units: [mage, enemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(mage.id),
    });
    return { state, mage, enemy };
  }
  const score = (mp: number, ability: typeof attack) => {
    const { state, mage, enemy } = setup(mp, 70);
    return _basicAiInternals.scoreSingleUnitOffensive(state, cat, mage, mage.position, enemy, ability);
  };

  it('at full MP the marginal cast outscores the free attack', () => {
    expect(score(48, fireStrike)).toBeGreaterThan(score(48, attack));
  });

  it('at low MP the penalty flips it: the free attack wins (conserve)', () => {
    expect(score(10, attack)).toBeGreaterThan(score(10, fireStrike));
  });

  it('the free attack score is invariant to MP (0-cost, never penalized)', () => {
    expect(score(48, attack)).toBe(score(10, attack));
  });
});

describe('S66 chunk 2 — decideBasicAi acceptance', () => {
  // Fire Mage at low MP (just enough for fire_strike), enemy adjacent on its
  // back tile (no evasion). Resistance dials whether the cast is marginal.
  function battle(fireResist: number) {
    const cat = loadDefaultCatalog();
    const mage = makeUnit({
      id: 'mg', spd: 10, ma: 9, pa: 4, hp: 50, maxMpBase: 48, mp: 10, classId: 'fire_mage',
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
      equipment: { leftHand: null, rightHand: wandOfLumen.id, headgear: null, armor: null, accessory: null },
    });
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 2, y: 1, layer: 0 }, facing: 'E',
      resistances: new Map<DamageTag, number>([['fire', fireResist]]),
    });
    const state = makeGameState({
      units: [mage, enemy], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(mage.id),
    });
    return { cat, state };
  }

  it('(A) conserves: a low-MP mage picks the free attack over a marginal cast', () => {
    const { cat, state } = battle(70); // fire_strike only marginally > attack
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(ATTACK);
  });

  it('(B) still casts a high-value spell at low MP (penalty stays subordinate)', () => {
    const { cat, state } = battle(0); // fire_strike clearly worth its MP
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(FIRE_STRIKE);
  });
});

describe('S66 chunk 2 — Ether restore-valuation rises as MP drops', () => {
  const cat = loadDefaultCatalog();
  // Alchemist with one Ether; one ally that is missing >= the Ether's
  // restore cap (pa 8 × 4 = 32) at two MP levels. With `restored` capped
  // equal for both, the score difference is purely the new scarcity
  // multiplier (mp 4 is scarcer than mp 16 of the same 48 pool).
  function etherScore(allyMp: number): number {
    const alch = makeUnit({
      id: 'alch', spd: 10, pa: 8, classId: 'alchemist', hp: 60, mp: 30,
      position: { x: 1, y: 1, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [ALCHEMY] }, passiveBuckets: {} },
      stockpile: new Map([[ETHER, 1]]),
    });
    // The ally is a real Fire Mage with its MP-gated spell kit — so MP is a
    // genuine bottleneck for it and the S73 restore gate keeps the throw
    // valued (an empty-loadout unit can't spend MP, and rightly scores 0).
    const ally = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, classId: 'fire_mage', maxMpBase: 48, mp: allyMp,
      position: { x: 1, y: 2, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
    });
    const state = makeGameState({
      units: [alch, ally], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });
    const cand = _basicAiInternals.bestThrowCandidate(state, cat, alch, [ally]);
    if (cand === null) throw new Error('expected an Ether throw candidate');
    return cand.score;
  }

  it('a drier ally makes the same Ether throw more valuable', () => {
    expect(etherScore(4)).toBeGreaterThan(etherScore(16));
  });
});
