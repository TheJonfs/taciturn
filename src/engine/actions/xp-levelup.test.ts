// TABA M2 (ADR-0139) — mid-battle level-up reducer. `system_xp_award` accrues
// XP and, on crossing XP_PER_LEVEL, levels the unit: swaps baseStats to the
// next precomputed entry and bumps current HP/MP by the effective-max delta.

import { describe, expect, it } from 'vitest';
import { makeAbilitiesCatalog } from '../abilities/test-fixtures.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { type Action, type BaseStats, type Unit } from '../types/index.ts';
import { reduceSystemXpAward, XP_PER_LEVEL } from './reducers.ts';

const catalog = makeAbilitiesCatalog({});

function stats(maxHpBase: number, maxMpBase: number): BaseStats {
  return {
    spd: 10,
    pa: 5,
    ma: 4,
    maxHpBase,
    maxMpBase,
    brave: 100,
    faith: 80,
    crit_chance: 0,
    crit_multiplier: 1,
  };
}

// A level-25 unit with precomputed L26/L27 stats (HP/MP grow by 20/10 a level).
function leveler(over?: Partial<Unit>): Unit {
  const base = makeUnit({ id: 'u1', spd: 10, maxHpBase: 100, maxMpBase: 50, hp: 100, mp: 50 });
  return {
    ...base,
    statsByLevel: new Map([
      [26, stats(120, 60)],
      [27, stats(140, 70)],
    ]),
    ...over,
  };
}

function award(unit: Unit, amount: number) {
  const state = makeGameState({ units: [unit], map: flatMap(3, 3) });
  const action = {
    type: 'system_xp_award',
    source: 'system',
    payload: { unitId: unit.id, amount },
  } as unknown as Extract<Action, { type: 'system_xp_award' }>;
  const result = reduceSystemXpAward(state, action, catalog);
  return { unit: result.newState.units.get(unit.id)!, outcome: result.outcome };
}

describe('reduceSystemXpAward', () => {
  it('accrues XP below the threshold without leveling', () => {
    const { unit, outcome } = award(leveler(), XP_PER_LEVEL - 1);
    expect(unit.level).toBe(25);
    expect(unit.xp).toBe(XP_PER_LEVEL - 1);
    expect(outcome.levelsGained).toBe(0);
    expect(unit.vitals.hp).toBe(100); // no stat change
  });

  it('levels up on rollover: swaps baseStats, bumps current HP/MP by the delta', () => {
    const { unit, outcome } = award(leveler(), XP_PER_LEVEL + 10);
    expect(unit.level).toBe(26);
    expect(unit.xp).toBe(10); // rolled over
    expect(unit.baseStats.maxHpBase).toBe(120);
    expect(unit.vitals.hp).toBe(120); // 100 + (120 − 100)
    expect(unit.vitals.mp).toBe(60); // 50 + (60 − 50)
    expect(outcome.levelsGained).toBe(1);
    expect(outcome.newLevel).toBe(26);
    expect(outcome.xpAfter).toBe(10);
  });

  it('applies multiple level-ups in one award, flooring HP/MP gains cumulatively', () => {
    const { unit, outcome } = award(leveler(), 2 * XP_PER_LEVEL + 50);
    expect(unit.level).toBe(27);
    expect(unit.xp).toBe(50);
    expect(unit.baseStats.maxHpBase).toBe(140);
    expect(unit.vitals.hp).toBe(140); // 100 + 20 + 20
    expect(unit.vitals.mp).toBe(70);
    expect(outcome.levelsGained).toBe(2);
  });

  it('stops leveling when the precompute is exhausted; surplus XP carries', () => {
    // Only L26 precomputed → a 3-level award levels once, banks the rest.
    const oneLevel = leveler({ statsByLevel: new Map([[26, stats(120, 60)]]) });
    const { unit, outcome } = award(oneLevel, 3 * XP_PER_LEVEL);
    expect(unit.level).toBe(26);
    expect(unit.xp).toBe(2 * XP_PER_LEVEL); // surplus carried to the boundary
    expect(outcome.levelsGained).toBe(1);
  });

  it('a unit with no statsByLevel accrues XP but never levels', () => {
    const noTable = makeUnit({ id: 'u1', spd: 10, hp: 100 });
    const { unit, outcome } = award(noTable, 5 * XP_PER_LEVEL);
    expect(unit.level).toBe(25);
    expect(unit.xp).toBe(5 * XP_PER_LEVEL);
    expect(outcome.levelsGained).toBe(0);
  });
});
