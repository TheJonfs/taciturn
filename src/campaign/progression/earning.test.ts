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
import { computeEarnedJp, defaultJpBase } from './earning.ts';

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

// S95: JP follows XP — the walk keys off `system_xp_award` entries in the
// log, so the factories build awards (the engine's mark of a connecting,
// effect-having action) rather than reconstructing outcome shapes.
function award(to: string, seq = 0, amount = 10): Action {
  return {
    sequenceNumber: seq,
    source: { kind: 'system' },
    actorId: undefined,
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    type: 'system_xp_award',
    payload: { unitId: unitId(to), amount },
  } as unknown as Action;
}

// A non-award action (the ability cast that GENERATED an award, a move, a
// status tick…) — must be invisible to the JP walk.
function nonAward(type = 'use_ability', actor: string | null = 'u1', seq = 0): Action {
  return {
    sequenceNumber: seq,
    source: { kind: 'player' },
    actorId: actor === null ? undefined : unitId(actor),
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    type,
    payload: {},
    outcome: { kind: type, perTargetResults: [{ hit: true }] },
  } as unknown as Action;
}

const U1: UnitId = unitId('u1');
const U2: UnitId = unitId('u2');
const U3: UnitId = unitId('u3');
const B25 = defaultJpBase(25); // floor(10 + 25/4) = 16

describe('defaultJpBase', () => {
  it('is floor(10 + level/4)', () => {
    expect(defaultJpBase(1)).toBe(10);
    expect(defaultJpBase(24)).toBe(16);
    expect(defaultJpBase(25)).toBe(16);
    expect(defaultJpBase(50)).toBe(22);
  });
});

describe('computeEarnedJp (award-keyed — JP follows XP, S95)', () => {
  const roster = [ru('u1'), ru('u2'), ru('u3')];

  it('an XP award to a roster unit pays base(level); every OTHER roster unit earns 1/8', () => {
    const earned = computeEarnedJp([award('u1')], roster);
    expect(earned.get(U1)).toBe(B25); // 16
    expect(earned.get(U2)).toBe(Math.floor(B25 / 8)); // floor(2) = 2
    expect(earned.get(U3)).toBe(Math.floor(B25 / 8)); // bench spillover too
  });

  it('accumulates over awards; the spillover total is floored once', () => {
    const log = [award('u1', 0), award('u1', 1)]; // 2 awards × 16
    const earned = computeEarnedJp(log, roster);
    expect(earned.get(U1)).toBe(2 * B25); // 32
    expect(earned.get(U2)).toBe(Math.floor((2 * B25) / 8)); // floor(4) = 4
  });

  it("scales the earner's share with the earner's ROSTER level (not the award amount)", () => {
    const earned = computeEarnedJp([award('u2', 0, 999)], [ru('u1', 1), ru('u2', 50)]);
    expect(earned.get(U2)).toBe(defaultJpBase(50)); // 22 — amount 999 is ignored
    expect(earned.get(U1)).toBe(Math.floor(defaultJpBase(50) / 8)); // floor(2.75) = 2
  });

  it('non-award actions are invisible — the casts themselves pay nothing', () => {
    // The engine's award IS the connecting-action mark; a log full of hits
    // with no awards (misses were filtered engine-side, or the units are
    // non-leveling) pays no JP.
    const log = [nonAward('use_ability'), nonAward('charged_action_resolve'), nonAward('move')];
    expect(computeEarnedJp(log, roster).size).toBe(0);
  });

  it('awards to NON-roster units (leveling enemies, guests) pay nothing', () => {
    const log = [award('enemy1'), award('guest1')];
    expect(computeEarnedJp(log, roster).size).toBe(0);
  });

  it('is deterministic — same log + roster yields the same result', () => {
    const log = [award('u1', 0), award('u2', 1)];
    expect([...computeEarnedJp(log, roster)]).toEqual([...computeEarnedJp(log, roster)]);
  });

  it('honors an injected base equation (the mid-session tuning seam)', () => {
    const earned = computeEarnedJp([award('u1')], roster, { base: () => 80 });
    expect(earned.get(U1)).toBe(80);
    expect(earned.get(U2)).toBe(10); // floor(80/8)
  });
});
