import { describe, expect, it } from 'vitest';
import { unitId, type Action, type UnitId } from '@engine/index.ts';
import {
  computeEarnedJp,
  defaultConnectingPredicate,
  DEFAULT_JP_PER_CONNECTING_ACTION,
} from './earning.ts';

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
const R = DEFAULT_JP_PER_CONNECTING_ACTION;

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

describe('computeEarnedJp', () => {
  it('sums the rate per connecting action, keyed by actor', () => {
    const log = [
      act({ actor: 'u1', hits: [true] }),
      act({ actor: 'u1', hits: [true] }),
      act({ actor: 'u2', hits: [true] }),
    ];
    const earned = computeEarnedJp(log);
    expect(earned.get(U1)).toBe(2 * R);
    expect(earned.get(U2)).toBe(1 * R);
  });

  it('excludes misses, reactions, non-offensive kinds, and actor-less actions', () => {
    const log = [
      act({ actor: 'u1', hits: [false] }), // miss
      act({ actor: 'u1', isReaction: true, hits: [true] }), // reaction
      act({ actor: 'u1', type: 'move', kind: 'move', hits: [] }), // move
      act({ actor: null, hits: [true] }), // no actor
    ];
    expect(computeEarnedJp(log).get(U1)).toBeUndefined();
  });

  it('is deterministic — same log yields the same result', () => {
    const log = [act({ actor: 'u1' }), act({ actor: 'u2' })];
    expect([...computeEarnedJp(log)]).toEqual([...computeEarnedJp(log)]);
  });

  it('honors an injected rate', () => {
    const log = [act({ actor: 'u1' }), act({ actor: 'u1' })];
    expect(computeEarnedJp(log, { rate: 10 }).get(U1)).toBe(20);
  });

  it('honors an injected connecting predicate (the mid-session seam)', () => {
    // A predicate that only counts throws.
    const log = [act({ actor: 'u1', kind: 'use_ability' }), act({ actor: 'u1', kind: 'use_throw_item' })];
    const earned = computeEarnedJp(log, {
      rate: 5,
      connecting: (a) => a.outcome?.kind === 'use_throw_item',
    });
    expect(earned.get(U1)).toBe(5);
  });
});
