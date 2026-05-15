// Tests for `pickName` and `pickTeamNames` — the Ivalician name picker.

import { describe, expect, it } from 'vitest';
import { ivalicianNames } from './index.ts';
import { pickName, pickTeamNames, type Rng } from './pick-name.ts';

// A deterministic RNG that cycles through a pre-set sequence of values
// in [0, 1). Used to pin picker output for assertions.
function seededRng(values: number[]): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length]!;
    i += 1;
    return v;
  };
}

describe('pickName', () => {
  it('returns a name from the pool', () => {
    const name = pickName(new Set(), seededRng([0]));
    expect(ivalicianNames).toContain(name);
  });

  it('excludes names in the used set', () => {
    // Build a used set of every pool entry except one; the picker has
    // exactly one choice.
    const onlyAvailable = ivalicianNames[5]!;
    const used = new Set(ivalicianNames.filter((n) => n !== onlyAvailable));
    expect(pickName(used, seededRng([0.5]))).toBe(onlyAvailable);
  });

  it('is deterministic given a seeded RNG', () => {
    const rng1 = seededRng([0.0, 0.5, 0.99]);
    const rng2 = seededRng([0.0, 0.5, 0.99]);
    expect(pickName(new Set(), rng1)).toBe(pickName(new Set(), rng2));
  });

  it('throws when the pool is exhausted', () => {
    const used = new Set(ivalicianNames);
    expect(() => pickName(used)).toThrow(/pool exhausted/);
  });
});

describe('pickTeamNames', () => {
  it('returns `count` names', () => {
    const names = pickTeamNames(4, new Set(), seededRng([0.1, 0.2, 0.3, 0.4]));
    expect(names).toHaveLength(4);
  });

  it('returns distinct names', () => {
    const names = pickTeamNames(8, new Set(), seededRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]));
    expect(new Set(names).size).toBe(names.length);
  });

  it('excludes names in the used set', () => {
    const excluded = new Set([ivalicianNames[0]!, ivalicianNames[1]!, ivalicianNames[2]!]);
    const names = pickTeamNames(4, excluded, seededRng([0.0, 0.25, 0.5, 0.75]));
    for (const name of names) {
      expect(excluded.has(name)).toBe(false);
    }
  });

  it('throws when `count` exceeds the available pool', () => {
    const used = new Set(ivalicianNames.slice(0, ivalicianNames.length - 1));
    // 1 name left in the pool but we asked for 2.
    expect(() => pickTeamNames(2, used)).toThrow(/pool exhausted/);
  });

  it('returns an empty array when count is 0', () => {
    expect(pickTeamNames(0, new Set())).toEqual([]);
  });

  it('rejects negative count', () => {
    expect(() => pickTeamNames(-1, new Set())).toThrow(/count must be >= 0/);
  });
});
