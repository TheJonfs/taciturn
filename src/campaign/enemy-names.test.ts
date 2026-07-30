// S100 — generated-enemy identity sampler tests. The behavioral pins:
// deterministic per seed (skirmish reloads must not reroll), party-unique
// names, gendered pool coherence (name never fights portrait), and
// forced-gender slots (authored gender without an authored name).

import { describe, expect, it } from 'vitest';
import { generatedEnemyIdentities } from './enemy-names.ts';
import { HIRE_NAMES_FEMALE, HIRE_NAMES_MALE } from './recruit.ts';

describe('generatedEnemyIdentities', () => {
  it('is deterministic: same seed → same identities, different seed → different draw', () => {
    const a = generatedEnemyIdentities(12345, 6);
    const b = generatedEnemyIdentities(12345, 6);
    expect(a).toEqual(b);
    // A different seed produces a different sequence (overwhelmingly —
    // pinned on a concrete pair so the test is not flaky-by-chance).
    const c = generatedEnemyIdentities(54321, 6);
    expect(a).not.toEqual(c);
  });

  it('never repeats a name within one party (pools not exhausted)', () => {
    const ids = generatedEnemyIdentities(777, 6);
    const names = ids.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each name comes from the pool MATCHING its rolled gender', () => {
    for (const { name, gender } of generatedEnemyIdentities(2024, 8)) {
      const pool = gender === 'female' ? HIRE_NAMES_FEMALE : HIRE_NAMES_MALE;
      const base = name.replace(/ \d+$/, ''); // strip any exhaustion suffix
      expect(pool).toContain(base);
    }
  });

  it('suffixes on pool exhaustion instead of colliding', () => {
    // Force every slot male with two more slots than the pool holds, so
    // exhaustion is guaranteed regardless of how deep the pool grows.
    const count = HIRE_NAMES_MALE.length + 2;
    const names = generatedEnemyIdentities(
      99,
      count,
      Array.from({ length: count }, () => 'male' as const),
    ).map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => / \d+$/.test(n))).toBe(true);
  });

  it('forced genders pin the slot and draw from the matching pool', () => {
    const ids = generatedEnemyIdentities(31337, 3, ['female', undefined, 'female']);
    expect(ids[0]!.gender).toBe('female');
    expect(ids[2]!.gender).toBe('female');
    for (const i of [0, 2] as const) {
      expect(HIRE_NAMES_FEMALE).toContain(ids[i]!.name.replace(/ \d+$/, ''));
    }
  });
});
