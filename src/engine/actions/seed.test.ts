import { deriveActionSeed } from './seed.ts';

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
