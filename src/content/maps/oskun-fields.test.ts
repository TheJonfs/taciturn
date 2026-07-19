// Oskun Fields map shape tests (S96). The map is data-only; assertions
// lock in Chris's grid per `docs/maps/oskun-fields.md`. Approach mirrors
// marshmoor.test.ts: spot-sample strategic tiles rather than asserting
// every tile of the 16×16 grid.

import { describe, expect, it } from 'vitest';
import { oskunFields, OSKUN_FIELDS_HEIGHT, OSKUN_FIELDS_WIDTH } from './oskun-fields.ts';
import { tileAt } from '@engine/index.ts';

describe('Oskun Fields map — structural', () => {
  it('is a 16×16 grid with every (x, y) covered exactly once at layer 0', () => {
    expect(OSKUN_FIELDS_WIDTH).toBe(16);
    expect(OSKUN_FIELDS_HEIGHT).toBe(16);
    expect(oskunFields.tiles.length).toBe(16 * 16);
    const seen = new Set<string>();
    for (const t of oskunFields.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
    }
    expect(seen.size).toBe(16 * 16);
  });
});

describe('Oskun Fields map — terrain derivation (water-table rule)', () => {
  it('the SW pond is deep water (elev 0)', () => {
    const t = tileAt(oskunFields, 0, 14, 0)!;
    expect(t.elevation).toBe(0);
    expect(t.terrain).toBe('water_deep');
  });

  it('the col-7 stream is shallow water (elev 1) down its whole run', () => {
    for (const y of [0, 2, 4, 6, 8]) {
      const t = tileAt(oskunFields, 7, y, 0)!;
      expect(t.elevation).toBe(1);
      expect(t.terrain).toBe('water_shallow');
    }
  });

  it("the stream's east-arm turn (row 8) and south run (col 11) are shallow", () => {
    expect(tileAt(oskunFields, 9, 8, 0)!.terrain).toBe('water_shallow');
    expect(tileAt(oskunFields, 11, 10, 0)!.terrain).toBe('water_shallow');
    expect(tileAt(oskunFields, 14, 13, 0)!.terrain).toBe('water_shallow');
  });

  it('ground tiles derive from elev ≥ 2', () => {
    const t = tileAt(oskunFields, 8, 0, 0)!;
    expect(t.elevation).toBe(3);
    expect(t.terrain).toBe('ground');
  });
});

describe('Oskun Fields map — landmarks', () => {
  it('the western ridge peaks at elev 6 (x1, y6 and y9)', () => {
    expect(tileAt(oskunFields, 1, 6, 0)!.elevation).toBe(6);
    expect(tileAt(oskunFields, 1, 9, 0)!.elevation).toBe(6);
  });

  it('the eastern knolls rise to elev 5 at (10,4)', () => {
    expect(tileAt(oskunFields, 10, 4, 0)!.elevation).toBe(5);
  });

  it('the south-central hill rises to elev 5 (x7-8, y12)', () => {
    expect(tileAt(oskunFields, 7, 12, 0)!.elevation).toBe(5);
    expect(tileAt(oskunFields, 8, 12, 0)!.elevation).toBe(5);
  });

  it('both deployment zones are entirely dry ground', () => {
    for (let y = 4; y <= 7; y++) {
      for (const x of [3, 4, 5, 9, 10, 11]) {
        const t = tileAt(oskunFields, x, y, 0)!;
        expect(t.terrain).toBe('ground');
      }
    }
  });
});
