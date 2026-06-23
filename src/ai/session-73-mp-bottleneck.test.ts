// Session 73, chunk 1 — MP-bottleneck gate (the self-restore softlock fix).
//
// The S66 MP-economy term (ADR-0109) values restoring MP purely as a
// function of how low the recipient's pool is (`mpScarcity`), regardless of
// whether the recipient's best play actually *needs* MP. That produces a
// softlock for an MP-light unit that can also manufacture MP: a low-MP
// Alchemist (whose only offense is a 0-MP bow) with an Ether in stockpile
// scores a self-Ether throw above advancing, then loops — compound costs
// ~the MP a throw returns, so the loop is self-sustaining.
//
// The gate: restore value is scaled by whether MP is a genuine bottleneck
// for the *recipient's* kit — its best MP-gated play vs. its best MP-free
// play. A bow Alchemist has no MP-gated offense/heal/buff → factor 0 →
// restore scores ~0 → the AI advances. A real caster (MP-gated offense or
// any MP-gated support) keeps factor 1 → restore stays valued, so a
// legitimately MP-dependent ally at low MP is not over-corrected.
//
// Layers:
//   1. mpBottleneckFactor — the gate primitive (bow Alchemist 0, caster 1).
//   2. bestThrowCandidate — a self-Ether throw on a no-bottleneck Alchemist
//      no longer scores; an Ether on a low-MP caster ally still does.
//   3. decideBasicAi — the constructed deterministic repro: an Alchemist at
//      low MP with an Ether and an enemy parked just outside bow range
//      advances instead of looping on self-restore.

import { describe, expect, it } from 'vitest';
import {
  bucketId,
  commandSetId,
  itemId,
  teamId,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { longbow } from '../content/items/longbow.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const ALCHEMY = commandSetId('alchemy');
const FIRE_SPELLS = commandSetId('fire_spells');
const ETHER = itemId('ether');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'ai' as const },
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

// A bow Alchemist: Alchemy command set (Compound + Throw, both 0-MP) plus
// the free bow Attack. No MP-gated offense/heal/buff in the kit, so MP is
// never its bottleneck — its best play is the free bow.
function bowAlchemist(mp: number): Unit {
  return makeUnit({
    id: 'alch', spd: 10, pa: 8, classId: 'alchemist', hp: 100, maxMpBase: 36, mp,
    position: { x: 1, y: 1, layer: 0 },
    loadout: { actionBuckets: { [FIRST]: [ALCHEMY] }, passiveBuckets: {} },
    equipment: { leftHand: null, rightHand: longbow.id, headgear: null, armor: null, accessory: null },
    stockpile: new Map([[ETHER, 1]]),
  });
}

describe('S73 chunk 1 — mpBottleneckFactor', () => {
  const cat = loadDefaultCatalog();
  const factor = (u: Unit): number => _basicAiInternals.mpBottleneckFactor(
    makeGameState({ units: [u], map: { width: 4, height: 4, tiles: flatGround(4, 4) }, teams: TEAMS }),
    cat, u,
  );

  it('is 0 for a bow Alchemist — its best play is the free bow', () => {
    expect(factor(bowAlchemist(4))).toBe(0);
  });

  it('is 1 for a Fire Mage — its offense is MP-gated', () => {
    const mage = makeUnit({
      id: 'mg', spd: 10, ma: 9, pa: 4, classId: 'fire_mage', maxMpBase: 48, mp: 10,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
    });
    expect(factor(mage)).toBe(1);
  });

  it('does not key on current MP — a full-MP caster is still a bottleneck unit', () => {
    const mage = makeUnit({
      id: 'mg', spd: 10, ma: 9, pa: 4, classId: 'fire_mage', maxMpBase: 48, mp: 48,
      position: { x: 0, y: 0, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
    });
    expect(factor(mage)).toBe(1);
  });
});

describe('S73 chunk 1 — bestThrowCandidate gates self-restore but not real need', () => {
  const cat = loadDefaultCatalog();

  it('a no-bottleneck Alchemist scores no self-Ether throw', () => {
    const alch = bowAlchemist(4);
    const state = makeGameState({
      units: [alch], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });
    expect(_basicAiInternals.bestThrowCandidate(state, cat, alch, [alch])).toBeNull();
  });

  it('an Ether on a low-MP caster ally still scores (no over-correction)', () => {
    const alch = bowAlchemist(30);
    const ally = makeUnit({
      id: 'ally', team: 'team_a', spd: 10, ma: 9, pa: 4, classId: 'fire_mage', maxMpBase: 48, mp: 4,
      position: { x: 1, y: 2, layer: 0 },
      loadout: { actionBuckets: { [FIRST]: [FIRE_SPELLS] }, passiveBuckets: {} },
    });
    const state = makeGameState({
      units: [alch, ally], map: { width: 6, height: 6, tiles: flatGround(6, 6) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });
    const cand = _basicAiInternals.bestThrowCandidate(state, cat, alch, [ally]);
    expect(cand).not.toBeNull();
    expect(cand!.score).toBeGreaterThan(0);
  });
});

describe('S73 chunk 1 — constructed deterministic repro', () => {
  const cat = loadDefaultCatalog();

  // One Alchemist at low MP with an Ether in stockpile; one enemy parked at
  // distance 10, beyond reach of any one-move bow shot (Move 3 + range 5).
  // No offensive plan scores this turn, so the only positive scored
  // candidate is the self-Ether throw — pre-gate the scorer picks it and
  // loops; post-gate it falls through to the advance.
  function repro(): ReturnType<typeof makeGameState> {
    const alch = bowAlchemist(4);
    const enemy = makeUnit({
      id: 'foe', team: 'team_b', spd: 10, classId: 'knight', maxHpBase: 60, hp: 60,
      position: { x: 11, y: 1, layer: 0 },
    });
    return makeGameState({
      units: [alch, enemy], map: { width: 14, height: 4, tiles: flatGround(14, 4) },
      teams: TEAMS, turnState: activeTurnFor(alch.id),
    });
  }

  it('advances toward the enemy instead of looping on self-restore', () => {
    const d = decideBasicAi(repro(), cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit') throw new Error('expected a commit');
    expect(d.action.type).toBe('move');
  });
});
