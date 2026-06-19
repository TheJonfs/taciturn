// Mountain Pass — Session 70's fourth authored map and the first to
// carry a *split* deployment config.
//
// A narrow NW→SE pass: a broad NW valley basin (the 3-5 cluster, rows
// 1-7 cols 1-8), a low central spine (the run of 2s at (6,8),(8,10),
// (8,11)), and a narrow SE defile walled by the bottom-center massif
// (cols 7-10, rows 12-15, elev 7-10 — the SW wall) and the rising NE
// ridge (cols 10-14, peak (14,5)=11). "Ripe for an ambush": the split
// config (see `content/deployment/registry.ts` → `mountain_pass`) sits
// the ambusher in the SE heights on both flanks of the defile, the
// victim out in the NW valley.
//
// Elevations span 2-11; every tile is ≥2, so the whole map is `ground`
// under the universal water-table convention (no water on this map).
//
// Indexing matches the brief's Appendix: the grid below stores y=0 first
// (the canonical engine row order); first index = row (y), second =
// column (x). So (x=14, y=5) = 11 is the NE peak.

import type { BattleMap, Tile } from '@engine/index.ts';

export const MOUNTAIN_PASS_WIDTH = 16;
export const MOUNTAIN_PASS_HEIGHT = 16;

// Per the S70 brief Appendix. Rows are y=0 (first) through y=15 (last);
// each row is a width-16 sequence of elevations.
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0
  [6, 5, 4, 5, 6, 7, 6, 7, 6, 7, 8, 9, 10, 9, 8, 7],
  // y=1
  [7, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8, 9, 7],
  // y=2
  [5, 4, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8, 9],
  // y=3
  [7, 5, 3, 3, 4, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 8],
  // y=4
  [6, 5, 4, 3, 4, 4, 3, 4, 6, 5, 7, 6, 8, 9, 10, 9],
  // y=5
  [7, 6, 3, 4, 4, 4, 4, 3, 4, 5, 6, 5, 6, 10, 11, 10],
  // y=6
  [6, 6, 4, 3, 4, 4, 4, 4, 3, 4, 5, 6, 5, 9, 10, 8],
  // y=7
  [7, 8, 5, 4, 4, 4, 3, 4, 4, 3, 4, 5, 6, 7, 8, 9],
  // y=8
  [8, 9, 6, 3, 4, 3, 2, 3, 4, 4, 3, 4, 6, 8, 8, 9],
  // y=9
  [9, 9, 5, 4, 3, 4, 3, 4, 3, 4, 4, 3, 5, 7, 9, 8],
  // y=10
  [8, 8, 6, 5, 4, 3, 4, 3, 2, 3, 4, 4, 5, 7, 8, 9],
  // y=11
  [9, 9, 7, 6, 5, 4, 3, 4, 2, 6, 4, 4, 4, 5, 7, 8],
  // y=12
  [8, 8, 7, 7, 6, 5, 4, 5, 7, 8, 7, 4, 4, 4, 5, 7],
  // y=13
  [7, 7, 5, 7, 8, 7, 6, 8, 9, 10, 8, 7, 4, 4, 4, 5],
  // y=14
  [5, 6, 6, 6, 7, 8, 7, 9, 8, 9, 8, 7, 7, 4, 4, 4],
  // y=15
  [4, 5, 7, 5, 6, 7, 8, 8, 9, 10, 9, 8, 6, 7, 4, 4],
];

function terrainFromElevation(elev: number): string {
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  return 'ground';
}

function buildMountainPass(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < MOUNTAIN_PASS_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < MOUNTAIN_PASS_WIDTH; x++) {
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
    width: MOUNTAIN_PASS_WIDTH,
    height: MOUNTAIN_PASS_HEIGHT,
    tiles,
  };
}

export const mountainPass: BattleMap = buildMountainPass();
