// Session 26 — pickTerrainVariantIndex determinism + boundary tests.
// The renderer relies on this function for per-tile texture selection;
// determinism guarantees that the same battle (same masterSeed, same
// map) renders identically across reloads.

import { describe, expect, it } from 'vitest';
import { pickTerrainVariantIndex, terrainTexturePoolFor, TERRAIN_MANIFEST } from './index.ts';

describe('pickTerrainVariantIndex', () => {
  it('returns 0 for an empty pool', () => {
    expect(pickTerrainVariantIndex(0, 0, 0, 0)).toBe(0);
  });

  it('returns 0 for a single-variant pool', () => {
    expect(pickTerrainVariantIndex(0, 0, 0, 1)).toBe(0);
    expect(pickTerrainVariantIndex(42, 7, 11, 1)).toBe(0);
  });

  it('is deterministic for the same (seed, x, y, poolSize)', () => {
    const a = pickTerrainVariantIndex(12345, 3, 7, 4);
    const b = pickTerrainVariantIndex(12345, 3, 7, 4);
    expect(a).toBe(b);
  });

  it('always returns an index in [0, poolSize)', () => {
    const poolSize = 4;
    for (let seed = 0; seed < 8; seed++) {
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          const idx = pickTerrainVariantIndex(seed, x, y, poolSize);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(poolSize);
        }
      }
    }
  });

  it('distributes across multiple variants for a non-degenerate map', () => {
    // Sample a 16×16 grid with masterSeed=0 (the test default) and
    // verify each of 4 variants gets at least *some* coverage. A bad
    // hash that collapses to a single index would fail this.
    const counts = [0, 0, 0, 0];
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const idx = pickTerrainVariantIndex(0, x, y, counts.length);
        counts[idx]! += 1;
      }
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
    }
  });

  it('varies output between different masterSeeds', () => {
    // For a fixed (x, y, poolSize=4), expect at least one of the next
    // few seeds to produce a different pick than seed=0.
    const base = pickTerrainVariantIndex(0, 5, 5, 4);
    let differs = false;
    for (let s = 1; s < 8; s++) {
      if (pickTerrainVariantIndex(s, 5, 5, 4) !== base) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});

describe('TERRAIN_MANIFEST', () => {
  it('registers a ground variant (the demo training-field terrain type)', () => {
    const pool = terrainTexturePoolFor('ground');
    expect(pool).not.toBeNull();
    expect(pool!.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null for an unregistered terrain type', () => {
    expect(terrainTexturePoolFor('stone-ridge')).toBeNull();
    expect(terrainTexturePoolFor('void')).toBeNull();
  });

  it('all registered pools are non-empty (manifest invariant)', () => {
    for (const [, pool] of TERRAIN_MANIFEST) {
      expect(pool.length).toBeGreaterThan(0);
    }
  });
});
