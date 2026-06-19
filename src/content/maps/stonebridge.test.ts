// Stonebridge map shape tests (Session 47). The map is data-only;
// assertions here lock in the spec in `docs/maps/stonebridge.md` and
// the constants exported by `stonebridge.ts`.
//
// Approach mirrors river-ridge.test.ts: spot-sample strategic tiles
// (deployment zones, rampart positions, bridge piers, deep channel)
// rather than asserting every tile in the 16×16 grid.

import { describe, expect, it } from 'vitest';
import {
  stonebridge,
  STONEBRIDGE_HEIGHT,
  STONEBRIDGE_WIDTH,
} from './stonebridge.ts';
import { tileAt } from '@engine/index.ts';
import { validateMap, type TerrainRegistry } from '@engine/index.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
  ['rampart', new Set(['land'])],
]);

describe('Stonebridge map — structural', () => {
  it('is a 16×16 grid', () => {
    expect(STONEBRIDGE_WIDTH).toBe(16);
    expect(STONEBRIDGE_HEIGHT).toBe(16);
    expect(stonebridge.width).toBe(16);
    expect(stonebridge.height).toBe(16);
    expect(stonebridge.tiles.length).toBe(16 * 16);
  });

  it('has every (x, y) covered exactly once at layer 0', () => {
    const seen = new Set<string>();
    for (const t of stonebridge.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
    }
    expect(seen.size).toBe(16 * 16);
  });
});

describe('Stonebridge map — terrain derivation', () => {
  it('elev 0 → water_deep', () => {
    const t = tileAt(stonebridge, 0, 6, 0)!;
    expect(t.elevation).toBe(0);
    expect(t.terrain).toBe('water_deep');
  });

  it('elev 1 → water_shallow', () => {
    const t = tileAt(stonebridge, 0, 4, 0)!;
    expect(t.elevation).toBe(1);
    expect(t.terrain).toBe('water_shallow');
  });

  it('elev 2 → ground', () => {
    const t = tileAt(stonebridge, 5, 0, 0)!;
    expect(t.elevation).toBe(2);
    expect(t.terrain).toBe('ground');
  });

  it('NW corner hill at (0, 0) is elev 8 ground (NOT rampart)', () => {
    const t = tileAt(stonebridge, 0, 0, 0)!;
    expect(t.elevation).toBe(8);
    expect(t.terrain).toBe('ground');
  });

  it('SW corner hill at (0, 15) is elev 8 ground (NOT rampart)', () => {
    const t = tileAt(stonebridge, 0, 15, 0)!;
    expect(t.elevation).toBe(8);
    expect(t.terrain).toBe('ground');
  });
});

describe('Stonebridge map — rampart positions', () => {
  // Per spec: 9 rampart tiles forming the SE keep walls.
  const RAMPARTS: ReadonlyArray<readonly [number, number]> = [
    // North wall: row 12, cols 10-15
    [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [15, 12],
    // West wall: (10, 13) and (10, 15); the gate is at (10, 14)
    [10, 13],
    // South wall: row 15, cols 10-11
    [10, 15], [11, 15],
  ];

  for (const [x, y] of RAMPARTS) {
    it(`(${x}, ${y}) is rampart at elev 8`, () => {
      const t = tileAt(stonebridge, x, y, 0)!;
      expect(t.terrain).toBe('rampart');
      expect(t.elevation).toBe(8);
    });
  }

  it('gate at (10, 14) is walkable ground, not rampart', () => {
    const t = tileAt(stonebridge, 10, 14, 0)!;
    expect(t.terrain).toBe('ground');
    expect(t.elevation).toBe(2);
  });

  it('exactly 9 rampart tiles in total', () => {
    const count = stonebridge.tiles.filter((t) => t.terrain === 'rampart').length;
    expect(count).toBe(9);
  });
});

describe('Stonebridge map — bridge and river', () => {
  it('bridge tiles at (6-7, 4-11) climb from elev 3 to a 6-tile peak', () => {
    // Spec: bridge piers rise from the banks (y=4, 11) up to a peak
    // (y=7, 8) at elev 6, symmetric N-S.
    expect(tileAt(stonebridge, 6, 4, 0)!.elevation).toBe(3);
    expect(tileAt(stonebridge, 6, 7, 0)!.elevation).toBe(6);
    expect(tileAt(stonebridge, 6, 8, 0)!.elevation).toBe(6);
    expect(tileAt(stonebridge, 6, 11, 0)!.elevation).toBe(3);
  });

  it('bridge tiles are ground (at elevation), not water', () => {
    expect(tileAt(stonebridge, 6, 8, 0)!.terrain).toBe('ground');
    expect(tileAt(stonebridge, 7, 8, 0)!.terrain).toBe('ground');
  });

  it('mid-river deep channel at col 0, rows 6-9 is water_deep', () => {
    expect(tileAt(stonebridge, 0, 6, 0)!.terrain).toBe('water_deep');
    expect(tileAt(stonebridge, 0, 9, 0)!.terrain).toBe('water_deep');
  });
});

// Deployment zones live in the registry now (S70); their coverage and
// flat-ground property are tested in
// `src/content/deployment/registry.test.ts`.

describe('Stonebridge map — passes terrain validation', () => {
  it('validates cleanly against the default registry', () => {
    const result = validateMap(stonebridge, REGISTRY);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
