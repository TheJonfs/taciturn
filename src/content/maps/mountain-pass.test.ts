// Mountain Pass map shape tests (S70). Spot-samples the spec landmarks
// from the brief's Appendix and confirms terrain validity. Deployment
// zones live in the registry (see content/deployment/registry.test.ts).

import { describe, expect, it } from 'vitest';
import {
  mountainPass,
  MOUNTAIN_PASS_HEIGHT,
  MOUNTAIN_PASS_WIDTH,
} from './mountain-pass.ts';
import { tileAt, validateMap, type TerrainRegistry } from '@engine/index.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
  ['rock', new Set(['land'])],
  ['grass_rock', new Set(['land'])],
]);

describe('Mountain Pass map — structural', () => {
  it('is a 16×16 grid', () => {
    expect(MOUNTAIN_PASS_WIDTH).toBe(16);
    expect(MOUNTAIN_PASS_HEIGHT).toBe(16);
    expect(mountainPass.tiles).toHaveLength(16 * 16);
  });

  it('covers every (x, y) exactly once at layer 0', () => {
    const seen = new Set<string>();
    for (const t of mountainPass.tiles) {
      expect(t.layer).toBe(0);
      const key = `${t.x},${t.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(256);
  });
});

describe('Mountain Pass map — landmark elevations', () => {
  it('NE peak (14, 5) is elev 11', () => {
    expect(tileAt(mountainPass, 14, 5, 0)!.elevation).toBe(11);
  });

  it('central low spine holds elev-2 tiles at (6,8), (8,10), (8,11)', () => {
    expect(tileAt(mountainPass, 6, 8, 0)!.elevation).toBe(2);
    expect(tileAt(mountainPass, 8, 10, 0)!.elevation).toBe(2);
    expect(tileAt(mountainPass, 8, 11, 0)!.elevation).toBe(2);
  });

  it('SW massif (the SE defile wall) rises to elev 9-10 at (8,13) and (9,13)', () => {
    expect(tileAt(mountainPass, 8, 13, 0)!.elevation).toBe(9);
    expect(tileAt(mountainPass, 9, 13, 0)!.elevation).toBe(10);
  });

  it('NW valley basin is low (elev 3) at (2,2)', () => {
    expect(tileAt(mountainPass, 2, 2, 0)!.elevation).toBe(3);
  });
});

describe('Mountain Pass map — terrain', () => {
  it('has no water (every elevation ≥ 2) and only land terrain', () => {
    for (const t of mountainPass.tiles) {
      expect(t.elevation).toBeGreaterThanOrEqual(2);
      expect(['ground', 'grass_rock', 'rock']).toContain(t.terrain);
    }
  });

  it('paints three elevation bands: ≥7 rock, 5-6 grass_rock, ≤4 ground (S70 visual)', () => {
    // The thresholds live as band data in MOUNTAIN_PASS_SPEC now (S98
    // Cartographer migration); the test pins the resulting terrain DATA at
    // and around each band boundary.
    for (const t of mountainPass.tiles) {
      const expected = t.elevation >= 7 ? 'rock' : t.elevation >= 5 ? 'grass_rock' : 'ground';
      expect(t.terrain).toBe(expected);
    }
    // Spot-checks across the bands, incl. both sides of each boundary.
    expect(tileAt(mountainPass, 9, 13, 0)!.terrain).toBe('rock'); // elev 10
    expect(tileAt(mountainPass, 5, 0, 0)!.terrain).toBe('rock'); // elev 7 — rock floor
    expect(tileAt(mountainPass, 0, 0, 0)!.terrain).toBe('grass_rock'); // elev 6 — top of mid band
    expect(tileAt(mountainPass, 1, 0, 0)!.terrain).toBe('grass_rock'); // elev 5 — mid-band floor
    expect(tileAt(mountainPass, 2, 0, 0)!.terrain).toBe('ground'); // elev 4 — lowlands
    expect(tileAt(mountainPass, 2, 2, 0)!.terrain).toBe('ground'); // elev 3
  });

  it('validates cleanly against the default registry (rock is registered)', () => {
    const result = validateMap(mountainPass, REGISTRY);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
