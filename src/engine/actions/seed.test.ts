import { deriveActionSeed, perTargetSeed } from './seed.ts';

describe('deriveActionSeed', () => {
  it('returns a stable value for the same (masterSeed, sequenceNumber)', () => {
    expect(deriveActionSeed(42, 0)).toBe(deriveActionSeed(42, 0));
    expect(deriveActionSeed(42, 5)).toBe(deriveActionSeed(42, 5));
  });

  it('produces different seeds for different sequence numbers', () => {
    const a = deriveActionSeed(42, 0);
    const b = deriveActionSeed(42, 1);
    const c = deriveActionSeed(42, 2);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('produces different seeds for different master seeds', () => {
    const a = deriveActionSeed(0, 0);
    const b = deriveActionSeed(1, 0);
    expect(a).not.toBe(b);
  });

  it('returns unsigned 32-bit integers', () => {
    for (let i = 0; i < 1000; i++) {
      const seed = deriveActionSeed(0xdead, i);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('perTargetSeed', () => {
  it('returns the action seed unchanged at targetIndex 0', () => {
    // Bit-identity at index 0 is the property that keeps single-target
    // RNG behavior unchanged across the AoE refactor — replays of pre-17
    // logs must not drift.
    expect(perTargetSeed(0xdeadbeef, 0)).toBe(0xdeadbeef);
    expect(perTargetSeed(0, 0)).toBe(0);
    expect(perTargetSeed(0xffffffff, 0)).toBe(0xffffffff);
  });

  it('produces stable values for the same (seed, targetIndex)', () => {
    expect(perTargetSeed(42, 1)).toBe(perTargetSeed(42, 1));
    expect(perTargetSeed(42, 7)).toBe(perTargetSeed(42, 7));
  });

  it('produces different seeds for different targetIndex values', () => {
    const a = perTargetSeed(42, 1);
    const b = perTargetSeed(42, 2);
    const c = perTargetSeed(42, 3);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
    // And none collide with the index-0 identity.
    expect(a).not.toBe(perTargetSeed(42, 0));
  });

  it('returns unsigned 32-bit integers', () => {
    for (let i = 0; i < 100; i++) {
      const s = perTargetSeed(0xdead, i);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
