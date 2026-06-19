// River Ridge — the first authored Mage War battlefield.
//
// Spec: `docs/maps/river-ridge.md` (v1.0). The grid below
// is the design doc's "Elevation Grid" verbatim. Terrain type derives
// from elevation per the universal water-table convention:
//   elev 0  → water_deep
//   elev 1  → water_shallow
//   elev ≥2 → ground
//
// Deployment zones live beside the terrain now (S70): see
// `src/content/deployment/registry.ts` (`river_ridge` → `default`),
// which authors Blue at rows 0-2 / cols 5-8 and Red at rows 11-13 /
// cols 5-8 — the same flat, ground tiles this map used to bake in.
//
// Convention on N/S orientation: in the engine, y=0 is the top row of
// the grid (the elevation grid in the design doc is printed with y=13
// at the top and y=0 at the bottom — a visual N/S convention; here
// rows are stored low-y-first so blue's zone, at "blue zone rows 0-2"
// per the spec, lands at the lower y values, "north" by canvas
// convention but consistent with the design doc's "blue is north"
// because the doc inverts the printed y axis).
//
// Session 33 (ADR-0073): water_shallow / water_deep are distinct
// terrain types registered against the `'water'` tag. Tidewalker /
// Float compose against any water-tagged terrain. The cliff-edge
// renderer reads elevation only — it draws on the west foot, the
// central climb (elev 2 → 3 → 4 → 7), the eastern perch (elev 9 → 2)
// without knowing the terrain string.

import type { BattleMap, Tile } from '@engine/index.ts';

export const RIVER_RIDGE_WIDTH = 14;
export const RIVER_RIDGE_HEIGHT = 14;

// Per the design doc's elevation grid. Rows are y=0 (first) through
// y=13 (last). Each row is a width-14 sequence of elevations.
//
// Source: docs/maps/river-ridge.md "Elevation Grid". The
// design doc prints y=13 at the top (visual N/S); this array stores
// y=0 first, the canonical engine row order. Comparing visually
// inverts the printed y axis, but the same x columns and same
// elevation values land at the same logical positions.
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=1
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=2
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=3
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=4
  [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=5
  [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=6 — ridge row
  [0, 0, 1, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
  // y=7 — ridge row + col-2 island
  [0, 0, 2, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
  // y=8 — ridge row + col-1 island start
  [0, 2, 1, 2, 3, 4, 7, 7, 7, 7, 9, 9, 9, 9],
  // y=9
  [0, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=10
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=11
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=12
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=13
  [0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

function terrainFromElevation(elev: number): string {
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  return 'ground';
}

function buildRiverRidge(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < RIVER_RIDGE_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < RIVER_RIDGE_WIDTH; x++) {
      const elev = row[x]!;
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: elev,
        terrain: terrainFromElevation(elev),
        properties: [],
      });
    }
  }
  return {
    width: RIVER_RIDGE_WIDTH,
    height: RIVER_RIDGE_HEIGHT,
    tiles,
  };
}

export const riverRidge: BattleMap = buildRiverRidge();
