// Marshmoor map shape tests (Session 52). The map is data-only;
// assertions here lock in the spec in `docs/maps/marshmoor.md` and the
// constants exported by `marshmoor.ts`.
//
// Approach mirrors stonebridge.test.ts: spot-sample strategic tiles
// (deployment zones, corner peaks, central flats, deep water) rather
// than asserting every tile in the 16×16 grid.

import { describe, expect, it } from 'vitest';
import {
  marshmoor,
  MARSHMOOR_HEIGHT,
  MARSHMOOR_WIDTH,
} from './marshmoor.ts';
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

describe('Marshmoor map — structural', () => {
  it('is a 16×16 grid', () => {
    expect(MARSHMOOR_WIDTH).toBe(16);
    expect(MARSHMOOR_HEIGHT).toBe(16);
    expect(marshmoor.width).toBe(16);
    expect(marshmoor.height).toBe(16);
    expect(marshmoor.tiles.length).toBe(16 * 16);
  });

  it('has every (x, y) covered exactly once at layer 0', () => {
    const seen = new Set<string>();
    for (const t of marshmoor.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
    }
    expect(seen.size).toBe(16 * 16);
  });
});

describe('Marshmoor map — terrain derivation', () => {
  it('elev 0 → water_deep', () => {
    const t = tileAt(marshmoor, 0, 0, 0)!;
    expect(t.elevation).toBe(0);
    expect(t.terrain).toBe('water_deep');
  });

  it('elev 1 → water_shallow', () => {
    const t = tileAt(marshmoor, 3, 0, 0)!;
    expect(t.elevation).toBe(1);
    expect(t.terrain).toBe('water_shallow');
  });

  it('elev 2 → ground', () => {
    const t = tileAt(marshmoor, 5, 0, 0)!;
    expect(t.elevation).toBe(2);
    expect(t.terrain).toBe('ground');
  });

  it('every tile is one of the three water-table terrains (no ramparts)', () => {
    for (const t of marshmoor.tiles) {
      expect(['ground', 'water_shallow', 'water_deep']).toContain(t.terrain);
    }
  });
});

describe('Marshmoor map — corner peaks', () => {
  it('NW peak rises to elev 5 at (1, 0) and (2, 0)', () => {
    expect(tileAt(marshmoor, 1, 0, 0)!.elevation).toBe(5);
    expect(tileAt(marshmoor, 2, 0, 0)!.elevation).toBe(5);
  });

  it('SE peak rises to elev 6 at (13, 15) and (14, 15)', () => {
    expect(tileAt(marshmoor, 13, 15, 0)!.elevation).toBe(6);
    expect(tileAt(marshmoor, 14, 15, 0)!.elevation).toBe(6);
  });

  it('the two peaks are the map high points (ground terrain)', () => {
    expect(tileAt(marshmoor, 14, 15, 0)!.terrain).toBe('ground');
    const maxElev = Math.max(...marshmoor.tiles.map((t) => t.elevation));
    expect(maxElev).toBe(6);
  });
});

describe('Marshmoor map — central flats', () => {
  it('central flat patch at cols 5-7, rows 6-7 is elev-2 ground', () => {
    for (const [x, y] of [
      [5, 6], [6, 6], [7, 6], [5, 7], [6, 7], [7, 7],
    ] as ReadonlyArray<readonly [number, number]>) {
      const t = tileAt(marshmoor, x, y, 0)!;
      expect(t.elevation).toBe(2);
      expect(t.terrain).toBe('ground');
    }
  });

  it('eastern-central flat patch at cols 8-10, rows 8-9 is elev-2 ground', () => {
    for (const [x, y] of [
      [8, 8], [9, 8], [10, 8], [8, 9], [9, 9], [10, 9],
    ] as ReadonlyArray<readonly [number, number]>) {
      const t = tileAt(marshmoor, x, y, 0)!;
      expect(t.elevation).toBe(2);
      expect(t.terrain).toBe('ground');
    }
  });
});

describe('Marshmoor map — deployment zones', () => {
  it('Blue (NE) zone covers cols 13-15 rows 0-2 (9 tiles)', () => {
    let count = 0;
    for (const t of marshmoor.tiles) {
      if (t.deploymentZone === TEAM_BLUE) count += 1;
    }
    expect(count).toBe(9);
    expect(tileAt(marshmoor, 13, 0, 0)!.deploymentZone).toBe(TEAM_BLUE);
    expect(tileAt(marshmoor, 15, 2, 0)!.deploymentZone).toBe(TEAM_BLUE);
    expect(tileAt(marshmoor, 12, 0, 0)!.deploymentZone).toBeUndefined();
    expect(tileAt(marshmoor, 13, 3, 0)!.deploymentZone).toBeUndefined();
  });

  it('Red (SW) zone covers cols 0-2 rows 13-15 (9 tiles)', () => {
    let count = 0;
    for (const t of marshmoor.tiles) {
      if (t.deploymentZone === TEAM_RED) count += 1;
    }
    expect(count).toBe(9);
    expect(tileAt(marshmoor, 0, 13, 0)!.deploymentZone).toBe(TEAM_RED);
    expect(tileAt(marshmoor, 2, 15, 0)!.deploymentZone).toBe(TEAM_RED);
    expect(tileAt(marshmoor, 3, 13, 0)!.deploymentZone).toBeUndefined();
    expect(tileAt(marshmoor, 0, 12, 0)!.deploymentZone).toBeUndefined();
  });

  it('every deployment-zone tile is land (elev ≥ 2), so no unit deploys in water', () => {
    for (const t of marshmoor.tiles) {
      if (t.deploymentZone !== undefined) {
        expect(t.elevation).toBeGreaterThanOrEqual(2);
        expect(t.terrain).toBe('ground');
      }
    }
  });

  it('preserves the intentional elev-4 asymmetry in each zone', () => {
    // NE zone's raised tile at (14, 1); SW zone's at (0, 15).
    expect(tileAt(marshmoor, 14, 1, 0)!.elevation).toBe(4);
    expect(tileAt(marshmoor, 14, 1, 0)!.deploymentZone).toBe(TEAM_BLUE);
    expect(tileAt(marshmoor, 0, 15, 0)!.elevation).toBe(4);
    expect(tileAt(marshmoor, 0, 15, 0)!.deploymentZone).toBe(TEAM_RED);
  });
});

describe('Marshmoor map — passes validation', () => {
  it('validates cleanly with the 5v5 team requirement', () => {
    const result = validateMap(marshmoor, REGISTRY, {
      requiredZonesPerTeam: new Map([
        [TEAM_BLUE, 5],
        [TEAM_RED, 5],
      ]),
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
