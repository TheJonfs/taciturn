import { describe, expect, it } from 'vitest';
import {
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
  type Action,
  type UnitId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_EARNED_BY_CLASS } from '../types.ts';
import { computeEarnedJp, defaultConnectingPredicate, defaultJpBase } from './earning.ts';

// A roster unit at a given level (all Monks; class doesn't matter to the walk).
function ru(id: string, level = 25): CampaignUnit {
  return {
    id: unitId(id),
    name: id,
    classId: classId('monk'),
    level,
    brave: 70,
    faith: 70,
    loadout: EMPTY_LOADOUT,
    equipment: EMPTY_UNIT_EQUIPMENT,
    vitals: { hp: 1, mp: 1 },
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
  };
}

// Minimal Action factory. `computeEarnedJp` reads only actorId / isReaction /
// outcome.kind / outcome.perTargetResults, so we build just those and cast —
// constructing full payload/source/target shapes would add nothing.
function act(over: {
  actor?: string | null;
  isReaction?: boolean;
  type?: string;
  kind?: string | null;
  hits?: ReadonlyArray<boolean>;
  seq?: number;
}): Action {
  const {
    actor = 'u1',
    isReaction = false,
    type = 'use_ability',
    kind = 'use_ability',
    hits = [true],
    seq = 0,
  } = over;
  return {
    sequenceNumber: seq,
    source: { kind: 'player' },
    actorId: actor === null ? undefined : unitId(actor),
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction,
    type,
    payload: {},
    outcome:
      kind === null ? undefined : { kind, perTargetResults: hits.map((hit) => ({ hit })) },
  } as unknown as Action;
}

const U1: UnitId = unitId('u1');
const U2: UnitId = unitId('u2');
const U3: UnitId = unitId('u3');
const B25 = defaultJpBase(25); // floor(10 + 25/4) = 16

describe('defaultConnectingPredicate', () => {
  it('accepts a non-reaction ability that landed at least one hit', () => {
    expect(defaultConnectingPredicate(act({ hits: [false, true] }))).toBe(true);
  });
  it('rejects a total miss', () => {
    expect(defaultConnectingPredicate(act({ hits: [false, false] }))).toBe(false);
  });
  it('rejects reactions even when they hit', () => {
    expect(defaultConnectingPredicate(act({ isReaction: true, hits: [true] }))).toBe(false);
  });
  it('rejects non-offensive action kinds (move) and outcome-less actions', () => {
    expect(defaultConnectingPredicate(act({ type: 'move', kind: 'move', hits: [] }))).toBe(false);
    expect(defaultConnectingPredicate(act({ kind: null }))).toBe(false);
  });
  it('accepts thrown items and charged resolves that connect', () => {
    expect(defaultConnectingPredicate(act({ kind: 'use_throw_item', hits: [true] }))).toBe(true);
    expect(defaultConnectingPredicate(act({ kind: 'charged_action_resolve', hits: [true] }))).toBe(
      true,
    );
  });
});

describe('defaultJpBase', () => {
  it('is floor(10 + level/4)', () => {
    expect(defaultJpBase(1)).toBe(10);
    expect(defaultJpBase(24)).toBe(16);
    expect(defaultJpBase(25)).toBe(16);
    expect(defaultJpBase(50)).toBe(22);
  });
});

describe('computeEarnedJp', () => {
  const roster = [ru('u1'), ru('u2'), ru('u3')];

  it('the actor earns base(level); every OTHER roster unit earns 1/8 of it', () => {
    const earned = computeEarnedJp([act({ actor: 'u1' })], roster);
    expect(earned.get(U1)).toBe(B25); // 16
    expect(earned.get(U2)).toBe(Math.floor(B25 / 8)); // floor(2) = 2
    expect(earned.get(U3)).toBe(Math.floor(B25 / 8)); // bench spillover too
  });

  it('accumulates over actions; the spillover total is floored once', () => {
    const log = [act({ actor: 'u1' }), act({ actor: 'u1' })]; // 2 actions × 16
    const earned = computeEarnedJp(log, roster);
    expect(earned.get(U1)).toBe(2 * B25); // 32
    expect(earned.get(U2)).toBe(Math.floor((2 * B25) / 8)); // floor(4) = 4
  });

  it("scales the actor's share with the actor's level", () => {
    const earned = computeEarnedJp([act({ actor: 'u2' })], [ru('u1', 1), ru('u2', 50)]);
    expect(earned.get(U2)).toBe(defaultJpBase(50)); // 22
    expect(earned.get(U1)).toBe(Math.floor(defaultJpBase(50) / 8)); // floor(2.75) = 2
  });

  it('excludes misses, reactions, non-offensive kinds — no one earns from them', () => {
    const log = [
      act({ actor: 'u1', hits: [false] }), // miss
      act({ actor: 'u1', isReaction: true, hits: [true] }), // reaction
      act({ actor: 'u1', type: 'move', kind: 'move', hits: [] }), // move
    ];
    expect(computeEarnedJp(log, roster).size).toBe(0);
  });

  it('only PLAYER-roster actions generate JP (enemy / actor-less actions do not)', () => {
    const log = [act({ actor: 'enemy1', hits: [true] }), act({ actor: null, hits: [true] })];
    expect(computeEarnedJp(log, roster).size).toBe(0);
  });

  it('is deterministic — same log + roster yields the same result', () => {
    const log = [act({ actor: 'u1' }), act({ actor: 'u2' })];
    expect([...computeEarnedJp(log, roster)]).toEqual([...computeEarnedJp(log, roster)]);
  });

  it('honors an injected base equation (the XP-reuse / mid-session seam)', () => {
    const earned = computeEarnedJp([act({ actor: 'u1' })], roster, { base: () => 80 });
    expect(earned.get(U1)).toBe(80);
    expect(earned.get(U2)).toBe(10); // floor(80/8)
  });
});
