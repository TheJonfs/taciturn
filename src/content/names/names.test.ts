// Tests for the Ivalician name pool structure. The picker semantics
// live in `pick-name.test.ts`.

import { describe, expect, it } from 'vitest';
import { ivalicianNames } from './index.ts';

describe('ivalicianNames pool', () => {
  it('is non-empty', () => {
    expect(ivalicianNames.length).toBeGreaterThan(0);
  });

  it('has at least 40 entries — enough for two full teams plus headroom', () => {
    // Two 4-unit teams = 8 names. A pool sized at >= 40 leaves a wide
    // margin for re-rolls, repeated drafts, and future team sizes.
    expect(ivalicianNames.length).toBeGreaterThanOrEqual(40);
  });

  it('has no duplicate entries', () => {
    const unique = new Set(ivalicianNames);
    expect(unique.size).toBe(ivalicianNames.length);
  });

  it('has every entry non-empty and trimmed', () => {
    for (const name of ivalicianNames) {
      expect(name.length).toBeGreaterThan(0);
      expect(name).toBe(name.trim());
    }
  });

  it('keeps every entry within the 24-character unit-name cap', () => {
    for (const name of ivalicianNames) {
      expect(name.length).toBeLessThanOrEqual(24);
    }
  });
});
