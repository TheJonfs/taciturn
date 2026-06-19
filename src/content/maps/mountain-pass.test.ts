// Mountain Pass map shape tests (S70). Spot-samples the spec landmarks
// from the brief's Appendix and confirms terrain validity. Deployment
// zones live in the registry (see content/deployment/registry.test.ts).

import { describe, expect, it } from 'vitest';
import {
  mountainPass,
  MOUNTAIN_PASS_HEIGHT,
  MOUNTAIN_PASS_ROCK_ELEVATION,
  MOUNTAIN_PASS_WIDTH,
} from './mountain-pass.ts';
import { tileAt, validateMap, type TerrainRegistry } from '@engine/index.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
  ['rock', new Set(['land'])],
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
  it('has no water (every elevation ≥ 2) and only ground/rock terrain', () => {
    for (const t of mountainPass.tiles) {
      expect(t.elevation).toBeGreaterThanOrEqual(2);
      expect(['ground', 'rock']).toContain(t.terrain);
    }
  });

  it('paints elevation ≥ 7 as rock and elevation 2-6 as ground (S70 visual)', () => {
    for (const t of mountainPass.tiles) {
      const expected = t.elevation >= MOUNTAIN_PASS_ROCK_ELEVATION ? 'rock' : 'ground';
      expect(t.terrain).toBe(expected);
    }
    // Spot-checks: SW massif peak is rock; NW valley is ground.
    expect(tileAt(mountainPass, 9, 13, 0)!.terrain).toBe('rock'); // elev 10
    expect(tileAt(mountainPass, 2, 2, 0)!.terrain).toBe('ground'); // elev 3
  });

  it('validates cleanly against the default registry (rock is registered)', () => {
    const result = validateMap(mountainPass, REGISTRY);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
