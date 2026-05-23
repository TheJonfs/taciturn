// River Ridge map shape tests. The map is data-only; assertions here
// lock in the spec called out in `docs/maps/river-ridge.md`
// and the constants exported by `river-ridge.ts`.
//
// Approach: spot-sample tiles at strategic positions (river column,
// ridge sections, deployment zones, islands) rather than asserting
// every single tile. The full grid would just duplicate the source —
// the assertions here protect the spec contract, not the data layout.

import { describe, expect, it } from 'vitest';
import {
  riverRidge,
  RIVER_RIDGE_HEIGHT,
  RIVER_RIDGE_WIDTH,
} from './river-ridge.ts';
import { teamId } from '@engine/index.ts';
import { tileAt } from '@engine/index.ts';
import { validateMap, type TerrainRegistry } from '@engine/index.ts';

const TEAM_BLUE = teamId('team_a');
const TEAM_RED = teamId('team_b');

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
]);

describe('River Ridge map — structural', () => {
  it('is a 14×14 grid', () => {
    expect(RIVER_RIDGE_WIDTH).toBe(14);
    expect(RIVER_RIDGE_HEIGHT).toBe(14);
    expect(riverRidge.width).toBe(14);
    expect(riverRidge.height).toBe(14);
    expect(riverRidge.tiles.length).toBe(14 * 14);
  });

  it('has every (x, y) covered exactly once at layer 0', () => {
    const seen = new Set<string>();
    for (const t of riverRidge.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
    }
    expect(seen.size).toBe(14 * 14);
  });
});

describe('River Ridge map — terrain derived from elevation', () => {
  it('elev 0 → water_deep', () => {
    const t = tileAt(riverRidge, 0, 0, 0)!;
    expect(t.elevation).toBe(0);
    expect(t.terrain).toBe('water_deep');
  });

  it('elev 1 → water_shallow', () => {
    const t = tileAt(riverRidge, 2, 0, 0)!;
    expect(t.elevation).toBe(1);
    expect(t.terrain).toBe('water_shallow');
  });

  it('elev 2 → ground', () => {
    const t = tileAt(riverRidge, 3, 0, 0)!;
    expect(t.elevation).toBe(2);
    expect(t.terrain).toBe('ground');
  });

  it('elev 7 (mid-ridge) → ground', () => {
    const t = tileAt(riverRidge, 6, 7, 0)!;
    expect(t.elevation).toBe(7);
    expect(t.terrain).toBe('ground');
  });

  it('elev 9 (perch) → ground', () => {
    const t = tileAt(riverRidge, 13, 7, 0)!;
    expect(t.elevation).toBe(9);
    expect(t.terrain).toBe('ground');
  });
});

describe('River Ridge map — islands', () => {
  it('Blue half island at col 1, rows 4-5 (elev 2)', () => {
    expect(tileAt(riverRidge, 1, 4, 0)!.elevation).toBe(2);
    expect(tileAt(riverRidge, 1, 5, 0)!.elevation).toBe(2);
  });

  it('Red half island at col 1, rows 8-9 (elev 2)', () => {
    expect(tileAt(riverRidge, 1, 8, 0)!.elevation).toBe(2);
    expect(tileAt(riverRidge, 1, 9, 0)!.elevation).toBe(2);
  });

  it('single-tile center island at col 2, row 7 (elev 2)', () => {
    expect(tileAt(riverRidge, 2, 7, 0)!.elevation).toBe(2);
    expect(tileAt(riverRidge, 2, 7, 0)!.terrain).toBe('ground');
  });
});

describe('River Ridge map — ridge climb', () => {
  it('west foot through east perch follows the spec', () => {
    // Per spec at the ridge row (y=7): col 3 → 2, col 4 → 3, col 5 → 4,
    // cols 6-9 → 7, cols 10-13 → 9.
    expect(tileAt(riverRidge, 3, 7, 0)!.elevation).toBe(2);
    expect(tileAt(riverRidge, 4, 7, 0)!.elevation).toBe(3);
    expect(tileAt(riverRidge, 5, 7, 0)!.elevation).toBe(4);
    expect(tileAt(riverRidge, 6, 7, 0)!.elevation).toBe(7);
    expect(tileAt(riverRidge, 9, 7, 0)!.elevation).toBe(7);
    expect(tileAt(riverRidge, 10, 7, 0)!.elevation).toBe(9);
    expect(tileAt(riverRidge, 13, 7, 0)!.elevation).toBe(9);
  });
});

describe('River Ridge map — deployment zones', () => {
  it('Blue zone covers rows 0-2 cols 5-8 (12 tiles)', () => {
    let blueCount = 0;
    for (const t of riverRidge.tiles) {
      if (t.deploymentZone === TEAM_BLUE) blueCount += 1;
    }
    expect(blueCount).toBe(12);
    // Spot-check zone tile and non-zone tile.
    expect(tileAt(riverRidge, 5, 0, 0)!.deploymentZone).toBe(TEAM_BLUE);
    expect(tileAt(riverRidge, 8, 2, 0)!.deploymentZone).toBe(TEAM_BLUE);
    expect(tileAt(riverRidge, 4, 0, 0)!.deploymentZone).toBeUndefined();
  });

  it('Red zone covers rows 11-13 cols 5-8 (12 tiles)', () => {
    let redCount = 0;
    for (const t of riverRidge.tiles) {
      if (t.deploymentZone === TEAM_RED) redCount += 1;
    }
    expect(redCount).toBe(12);
    expect(tileAt(riverRidge, 5, 11, 0)!.deploymentZone).toBe(TEAM_RED);
    expect(tileAt(riverRidge, 8, 13, 0)!.deploymentZone).toBe(TEAM_RED);
    expect(tileAt(riverRidge, 4, 13, 0)!.deploymentZone).toBeUndefined();
  });
});

describe('River Ridge map — passes validation', () => {
  it('validates cleanly against the default registry with 4-unit team requirement', () => {
    const result = validateMap(riverRidge, REGISTRY, {
      requiredZonesPerTeam: new Map([
        [TEAM_BLUE, 4],
        [TEAM_RED, 4],
      ]),
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
