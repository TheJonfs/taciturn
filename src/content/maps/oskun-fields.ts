// Oskun Fields — the Chapter 1 node-1 battlefield (S96, Chris's grid).
//
// Spec: `docs/maps/oskun-fields.md` (v1.0). The grid below is Chris's
// elevation data verbatim. 16×16 single layer.
//
// Theme: open farmland split by a winding stream. Shallow water lies
// along the NW top edge (row 0, x0-7), narrows into a stream running
// south down col 7 (y0-8), turns east along row 8 (x7-11), south again
// down col 11 (y8-13), and exits east along row 13 (x11-15) — a soft
// divider (wade cost 2) separating a hilly west half from gentler
// eastern fields. A deep pond sits in the SW corner (x0-1, y14-15).
//
// Landmarks:
//   - Western ridge (x0-2, y6-9, elev 4-6, twin peaks of 6): the map's
//     high ground, overlooking the west bank.
//   - South-central hill (x6-8, y11-14, elev 4-5): commands the stream's
//     southern arm.
//   - Eastern knolls (x9-10, y4-6, elev 4-5): the east bank's answer,
//     right across the stream from the west deployment.
//
// Terrain conventions follow the universal water-table rule (per
// `docs/maps/river-ridge.md` and ADR-0073):
//   elev 0  → water_deep
//   elev 1  → water_shallow
//   elev ≥2 → ground
//
// Deployment zones live beside the terrain (S70): see
// `src/content/deployment/registry.ts` (`oskun_fields` → `default`).
// Blue (player) west bank cols 3-5 / rows 4-7; Red (enemy) eastern
// knolls cols 9-11 / rows 4-7 — the engagement crosses the col-7 stream.

import type { BattleMap, Tile } from '@engine/index.ts';

export const OSKUN_FIELDS_WIDTH = 16;
export const OSKUN_FIELDS_HEIGHT = 16;

// Chris's elevation grid, rows y=0 (first) through y=15 (last), columns
// x=0 (west) through x=15 (east).
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0 — shallow water along the NW top edge; NE fields
  [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 2, 3],
  // y=1
  [1, 2, 3, 3, 3, 3, 3, 1, 3, 2, 2, 3, 3, 2, 3, 2],
  // y=2
  [3, 3, 2, 3, 3, 4, 3, 1, 3, 2, 2, 3, 3, 3, 3, 3],
  // y=3
  [4, 4, 3, 2, 3, 3, 3, 1, 3, 3, 3, 3, 2, 2, 2, 3],
  // y=4 — eastern knolls begin (x9-10)
  [2, 2, 3, 3, 2, 3, 3, 1, 3, 4, 5, 3, 2, 4, 2, 3],
  // y=5
  [3, 3, 4, 3, 2, 2, 2, 1, 3, 4, 4, 3, 2, 2, 2, 3],
  // y=6 — western ridge peak (x1 elev 6)
  [5, 6, 4, 4, 3, 3, 2, 1, 3, 4, 4, 3, 3, 3, 3, 3],
  // y=7
  [4, 5, 5, 4, 4, 3, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3],
  // y=8 — the stream turns east (x7-11)
  [4, 5, 5, 4, 4, 3, 2, 1, 1, 1, 1, 1, 3, 2, 3, 3],
  // y=9 — western ridge second peak (x1 elev 6)
  [5, 6, 4, 3, 3, 3, 2, 2, 2, 2, 2, 1, 3, 2, 3, 2],
  // y=10
  [3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 2, 1, 3, 3, 3, 3],
  // y=11 — south-central hill begins (x7-8)
  [3, 2, 3, 4, 3, 2, 3, 4, 5, 3, 2, 1, 3, 2, 2, 3],
  // y=12
  [3, 3, 2, 3, 3, 3, 4, 5, 5, 3, 2, 1, 3, 3, 3, 3],
  // y=13 — the stream exits east (x11-15)
  [3, 2, 1, 2, 3, 3, 5, 5, 4, 3, 2, 1, 1, 1, 1, 1],
  // y=14 — SW pond begins
  [0, 1, 2, 3, 3, 3, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2],
  // y=15
  [0, 0, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];

function terrainFromElevation(elev: number): string {
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  return 'ground';
}

function buildOskunFields(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < OSKUN_FIELDS_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < OSKUN_FIELDS_WIDTH; x++) {
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
    width: OSKUN_FIELDS_WIDTH,
    height: OSKUN_FIELDS_HEIGHT,
    tiles,
  };
}

export const oskunFields: BattleMap = buildOskunFields();
