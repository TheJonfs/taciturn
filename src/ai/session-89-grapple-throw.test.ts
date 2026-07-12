// Session 89 — Grapple-throw scoring (the Monk's Bear's Heave).
//
// The AI values a `grapple_throw` ability by the fall its landing emits —
// the melee analog of a Worldcraft drop, read through the same shared
// `fallValueForOccupant` gate (drop > 1, FALLING_DAMAGE_PER_LEVEL × drop,
// × killValue). Two layers:
//   1. `bestGrappleThrowCandidate` — enumeration + valuation: picks the
//      deepest-drop legal destination, declines flat ground, respects MP.
//   2. `decideBasicAi` — a Monk beside an enemy on a ledge heaves it off
//      when the fall beats its best Fist; on flat ground it never throws.

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  bucketId,
  commandSetId,
  teamId,
  type Position,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const FIRST = bucketId('first_action');
const BEARS_HEAVE = abilityId('bears_heave');
const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function gridMap(width: number, height: number, elevAt: (x: number, y: number) => number): {
  width: number; height: number; tiles: Tile[];
} {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: elevAt(x, y), terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

function monk(id: string, pos: Position, opts: { pa?: number; mp?: number } = {}): Unit {
  return makeUnit({
    id,
    team: 'team_a',
    spd: 10,
    pa: opts.pa ?? 5,
    classId: 'monk',
    maxHpBase: 60,
    hp: 60,
    maxMpBase: 20,
    mp: opts.mp ?? 20,
    position: pos,
    loadout: { actionBuckets: { [FIRST]: [commandSetId('martial_arts')] }, passiveBuckets: {} },
  });
}

function foe(id: string, pos: Position, hp = 200): Unit {
  return makeUnit({
    id, team: 'team_b', spd: 10, pa: 6, classId: 'knight',
    maxHpBase: 200, hp, position: pos,
  });
}

// Monk at (1,1) adjacent to the enemy at (2,1), both on an elev-6 plateau.
// The tile at (4,1) — manhattan 2 from the enemy, inside Bear's Heave's
// throw radius — is the variable (a pit or level ground).
function battle(pitElev: number, opts: { monkMp?: number } = {}) {
  const cat = loadDefaultCatalog();
  const actor = monk('mk', { x: 1, y: 1, layer: 0 }, { mp: opts.monkMp ?? 20 });
  const enemy = foe('foe', { x: 2, y: 1, layer: 0 });
  const state = makeGameState({
    units: [actor, enemy],
    map: gridMap(6, 6, (x, y) => (x === 4 && y === 1 ? pitElev : 6)),
    teams: TEAMS,
    turnState: activeTurnFor(actor.id),
  });
  return { cat, state, actor, enemy };
}

describe('S89 — bestGrappleThrowCandidate (enumeration + valuation)', () => {
  it('picks the deepest-drop destination inside the throw diamond', () => {
    const { cat, state, actor } = battle(0); // (4,1) elev 0 → drop 6 → 60
    const cand = _basicAiInternals.bestGrappleThrowCandidate(state, cat, actor, [
      state.units.get('foe' as Unit['id'])!,
    ]);
    expect(cand).not.toBeNull();
    if (cand === null) throw new Error('expected a candidate');
    expect(cand.action.type).toBe('use_ability');
    if (cand.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(cand.action.payload.abilityId).toEqual(BEARS_HEAVE);
    const t = cand.action.payload.target;
    expect(t.kind).toBe('grapple_throw');
    if (t.kind !== 'grapple_throw') throw new Error('expected grapple_throw target');
    expect(t.unitId).toEqual('foe');
    expect({ x: t.destination.x, y: t.destination.y }).toEqual({ x: 4, y: 1 });
    // Drop 6 × 10/level × killValue 1 (full HP), minus a negligible MP term.
    expect(cand.score).toBeGreaterThan(50);
  });

  it('returns null on flat ground (no drop → no value, no sideways shuffling)', () => {
    const { cat, state, actor } = battle(6); // every tile level → drop 0
    const cand = _basicAiInternals.bestGrappleThrowCandidate(state, cat, actor, [
      state.units.get('foe' as Unit['id'])!,
    ]);
    expect(cand).toBeNull();
  });

  it('a drop of exactly 1 is below the fall gate → null', () => {
    const { cat, state, actor } = battle(5); // drop 1 — engine deals no fall damage
    const cand = _basicAiInternals.bestGrappleThrowCandidate(state, cat, actor, [
      state.units.get('foe' as Unit['id'])!,
    ]);
    expect(cand).toBeNull();
  });

  it('respects MP affordability (mp 0 < Bear’s Heave cost → null)', () => {
    const { cat, state, actor } = battle(0, { monkMp: 0 });
    const cand = _basicAiInternals.bestGrappleThrowCandidate(state, cat, actor, [
      state.units.get('foe' as Unit['id'])!,
    ]);
    expect(cand).toBeNull();
  });
});

describe('S89 — decideBasicAi heaves an enemy off a ledge', () => {
  it('picks Bear’s Heave when the fall beats the best Fist', () => {
    const { cat, state } = battle(0); // drop 6 → 60 vs a ~PA-5 Fist chip
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') throw new Error('expected use_ability');
    expect(d.action.payload.abilityId).toEqual(BEARS_HEAVE);
    const t = d.action.payload.target;
    expect(t.kind).toBe('grapple_throw');
    if (t.kind === 'grapple_throw') {
      expect({ x: t.destination.x, y: t.destination.y }).toEqual({ x: 4, y: 1 });
    }
  });

  it('never throws on flat ground (uses a Fist or repositions instead)', () => {
    const { cat, state } = battle(6);
    const d = decideBasicAi(state, cat);
    if (d.kind === 'commit' && d.action.type === 'use_ability') {
      expect(d.action.payload.abilityId).not.toEqual(BEARS_HEAVE);
    }
  });
});
