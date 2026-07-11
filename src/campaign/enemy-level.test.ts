// TABA economy — the single enemy-level lever (M3 economy brief, Stage 0).

import { describe, expect, it } from 'vitest';
import { DIFFICULTY_FACTOR, partyAverageLevel, resolveEnemyLevel } from './enemy-level.ts';
import { m0Roster } from './roster.ts';

describe('resolveEnemyLevel', () => {
  it('is partyAvg + nodeOffset (+ the reserved difficulty term)', () => {
    expect(resolveEnemyLevel(25, 0)).toBe(25);
    expect(resolveEnemyLevel(25, 3)).toBe(28);
    expect(resolveEnemyLevel(25, -2)).toBe(23);
  });

  it('the reserved difficulty term defaults to the hardwired 0 (D-econ-4)', () => {
    expect(DIFFICULTY_FACTOR).toBe(0);
    expect(resolveEnemyLevel(25, 5)).toBe(resolveEnemyLevel(25, 5, DIFFICULTY_FACTOR));
  });

  it('an explicit difficulty term is ADDITIVE (never multiplicative)', () => {
    // Structure-now-expose-later: a future difficulty setting shifts every
    // node by the same amount, preserving authored relative pacing.
    expect(resolveEnemyLevel(25, 3, 2) - resolveEnemyLevel(25, 3)).toBe(2);
    expect(resolveEnemyLevel(25, -2, 2) - resolveEnemyLevel(25, -2)).toBe(2);
  });
});

describe('partyAverageLevel', () => {
  it('averages ACTIVE units, rounded to the nearest level', () => {
    const roster = [
      { ...m0Roster[0]!, level: 24 },
      { ...m0Roster[1]!, level: 25 },
      { ...m0Roster[2]!, level: 27 },
    ];
    expect(partyAverageLevel(roster)).toBe(25); // 76/3 = 25.33 → 25
  });

  it('excludes lost units from the average', () => {
    const roster = [
      { ...m0Roster[0]!, level: 20 },
      { ...m0Roster[1]!, level: 30, fate: 'lost' as const },
    ];
    expect(partyAverageLevel(roster)).toBe(20);
  });

  it('throws loudly when no active units remain', () => {
    const roster = [{ ...m0Roster[0]!, fate: 'lost' as const }];
    expect(() => partyAverageLevel(roster)).toThrow(/no active units/);
  });
});
