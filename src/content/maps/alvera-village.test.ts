// Alvera Village map shape tests (S96). The map is data-only; assertions
// lock in Chris's grid per `docs/maps/alvera-village.md` — especially the
// building architecture (elev-8 walls, elev-3 interiors, the four door
// gaps) that the coming special-features pass will build on.

import { describe, expect, it } from 'vitest';
import {
  alveraVillage,
  ALVERA_VILLAGE_HEIGHT,
  ALVERA_VILLAGE_WIDTH,
} from './alvera-village.ts';
import { tileAt } from '@engine/index.ts';

describe('Alvera Village map — structural', () => {
  it('is a 16×16 grid with every (x, y) covered exactly once at layer 0', () => {
    expect(ALVERA_VILLAGE_WIDTH).toBe(16);
    expect(ALVERA_VILLAGE_HEIGHT).toBe(16);
    expect(alveraVillage.tiles.length).toBe(16 * 16);
    const seen = new Set<string>();
    for (const t of alveraVillage.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
    }
    expect(seen.size).toBe(16 * 16);
  });
});

describe('Alvera Village map — the river', () => {
  it('the diagonal channel is deep from the NE mouth to the row-8 junction', () => {
    expect(tileAt(alveraVillage, 15, 0, 0)!.terrain).toBe('water_deep');
    expect(tileAt(alveraVillage, 13, 2, 0)!.terrain).toBe('water_deep');
    expect(tileAt(alveraVillage, 11, 4, 0)!.terrain).toBe('water_deep');
    expect(tileAt(alveraVillage, 9, 6, 0)!.terrain).toBe('water_deep');
  });

  it('the row-8 east-west channel is deep across x0-8 and dry from x11', () => {
    for (let x = 0; x <= 8; x++) {
      expect(tileAt(alveraVillage, x, 8, 0)!.terrain).toBe('water_deep');
    }
    expect(tileAt(alveraVillage, 11, 8, 0)!.terrain).toBe('ground');
  });

  it('the fords: shallow row 7 north of the channel, shallow row 9 south', () => {
    expect(tileAt(alveraVillage, 3, 7, 0)!.terrain).toBe('water_shallow');
    expect(tileAt(alveraVillage, 3, 9, 0)!.terrain).toBe('water_shallow');
  });
});

describe('Alvera Village map — architecture (elev-8 walls, doors)', () => {
  it('building walls stand at elev 8 (ground terrain, jump-impassable height)', () => {
    for (const [x, y] of [
      [0, 0], // NW manor corner
      [0, 11], // SW house corner
      [6, 12], // south-central house corner
      [15, 11], // SE house corner
    ] as const) {
      const t = tileAt(alveraVillage, x, y, 0)!;
      expect(t.elevation).toBe(8);
      expect(t.terrain).toBe('ground');
    }
  });

  it('interiors sit at elev 3 inside the walls', () => {
    expect(tileAt(alveraVillage, 2, 1, 0)!.elevation).toBe(3); // manor
    expect(tileAt(alveraVillage, 2, 13, 0)!.elevation).toBe(3); // SW house
    expect(tileAt(alveraVillage, 8, 13, 0)!.elevation).toBe(3); // central house
    expect(tileAt(alveraVillage, 13, 13, 0)!.elevation).toBe(3); // SE house
  });

  it('the four door gaps break the walls at elev 3', () => {
    expect(tileAt(alveraVillage, 2, 3, 0)!.elevation).toBe(3); // manor south door
    expect(tileAt(alveraVillage, 4, 13, 0)!.elevation).toBe(3); // SW east door
    expect(tileAt(alveraVillage, 8, 12, 0)!.elevation).toBe(3); // central north door
    expect(tileAt(alveraVillage, 12, 13, 0)!.elevation).toBe(3); // SE west door
  });

  it('the road (row 10) and both lanes (cols 5 and 11) run at elev 2', () => {
    for (let x = 0; x < 16; x++) {
      expect(tileAt(alveraVillage, x, 10, 0)!.elevation).toBe(2);
    }
    for (const y of [11, 13, 15]) {
      expect(tileAt(alveraVillage, 5, y, 0)!.elevation).toBe(2);
      expect(tileAt(alveraVillage, 11, y, 0)!.elevation).toBe(2);
    }
  });

  it('both deployment zones are entirely dry ground', () => {
    for (const x of [6, 7, 8, 9, 10, 11]) {
      for (const y of [10, 11]) {
        expect(tileAt(alveraVillage, x, y, 0)!.terrain).toBe('ground');
      }
    }
    for (const x of [1, 2, 3, 4]) {
      for (const y of [4, 5, 6]) {
        expect(tileAt(alveraVillage, x, y, 0)!.terrain).toBe('ground');
      }
    }
  });
});
