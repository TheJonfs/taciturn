// Marshmoor — the third authored battlefield (Session 52).
//
// Spec: `docs/maps/marshmoor.md` (v1.0). The grid below is the S52
// brief's "Elevation Grid" verbatim. 16×16 single layer.
//
// Theme: a wetlands archipelago. Most of the map is water (elev 0-1);
// land is scattered islands, two central flat patches, and two corner
// peaks. Crossing the marsh is an island-hop or a wade — deep water is
// universally enterable (ADR-0073) but costs 3 move points (2 with
// Tidewalker), so the map taxes heavy melee and rewards water-mobility.
//
// Terrain conventions follow the universal water-table rule (per
// `docs/maps/river-ridge.md` and ADR-0073):
//   elev 0  → water_deep
//   elev 1  → water_shallow
//   elev ≥2 → ground
//
// No ramparts on Marshmoor (those are Stonebridge architecture).
//
// Deployment zones live beside the terrain now (S70): see
// `src/content/deployment/registry.ts` (`marshmoor` → `default`). Two
// opposite-corner 3×3 grids:
//   NE zone (team_a / Blue): cols 13-15, rows 0-2 (9 tiles)
//   SW zone (team_b / Red):  cols 0-2,   rows 13-15 (9 tiles)
// Manhattan distance between zone centers is 26 tiles — the longest
// pre-engagement window of any v1 map, by design (room for buffing /
// terraforming / setup before the lines meet).
//
// Intentional elevation asymmetry within the zones: the NE zone holds
// an elev-4 tile at (14, 1); the SW zone an elev-4 tile at (0, 15).
// These are visual variety, not a gameplay-balancing feature — see the
// map doc. Both zones are otherwise land (elev 2-3); no zone tile is
// water, so every unit deploys on solid ground.
//
// The two corner *peaks* (NW elev 5 at cols 1-2/rows 0-1; SE elev 6 at
// cols 13-14/rows 14-15) sit in the corners NOT used for deployment,
// reached along a mostly-walkable edge spine. Claiming the high ground
// pulls a unit toward a corner and away from the central flats — a
// tempo cost, not a free perch. With the S52 bow range-from-height
// mechanic these peaks become premium archer objectives.

import type { BattleMap, Tile } from '@engine/index.ts';

export const MARSHMOOR_WIDTH = 16;
export const MARSHMOOR_HEIGHT = 16;

// Per the S52 brief's elevation grid. Rows are y=0 (first, "north" by
// canvas convention) through y=15 (last, "south"). Columns are x=0
// (west) through x=15 (east).
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0  — NW corner peak (elev 5) at cols 1-2; mostly water eastward
  [0, 5, 5, 1, 1, 2, 2, 0, 0, 0, 1, 1, 1, 2, 2, 3],
  // y=1  — NE deployment zone begins at cols 13-15 (elev 2/4/2)
  [0, 4, 4, 1, 1, 2, 2, 0, 2, 2, 1, 2, 1, 2, 4, 2],
  // y=2
  [0, 3, 3, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 2, 2, 2],
  // y=3
  [0, 2, 2, 1, 0, 2, 0, 2, 1, 0, 1, 1, 1, 1, 1, 1],
  // y=4
  [0, 2, 2, 1, 1, 0, 1, 0, 1, 2, 1, 1, 1, 1, 2, 1],
  // y=5
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1],
  // y=6  — west-central flat shelf (cols 0-3, elev 2)
  [2, 2, 2, 2, 1, 2, 2, 2, 1, 0, 0, 1, 0, 1, 2, 1],
  // y=7  — central flat patch (cols 5-7, elev 2)
  [1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 1],
  // y=8  — eastern-central flat patch (cols 8-10, elev 2)
  [1, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1],
  // y=9
  [1, 2, 1, 1, 2, 0, 0, 1, 2, 2, 2, 1, 2, 2, 2, 2],
  // y=10
  [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  // y=11
  [1, 2, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 2, 2, 0],
  // y=12
  [1, 1, 1, 1, 1, 1, 2, 1, 2, 0, 2, 0, 1, 2, 2, 0],
  // y=13 — SW deployment zone begins at cols 0-2 (elev 2/2/2)
  [2, 2, 2, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 3, 2, 0],
  // y=14
  [2, 3, 2, 1, 2, 1, 2, 2, 0, 2, 2, 1, 1, 4, 4, 0],
  // y=15 — SE corner peak (elev 6) at cols 13-14
  [4, 2, 2, 1, 1, 1, 0, 0, 0, 2, 2, 1, 1, 6, 6, 0],
];

function terrainFromTile(elev: number): string {
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  return 'ground';
}

function buildMarshmoor(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < MARSHMOOR_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < MARSHMOOR_WIDTH; x++) {
      const elev = row[x]!;
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: elev,
        terrain: terrainFromTile(elev),
        properties: [],
      });
    }
  }
  return {
    width: MARSHMOOR_WIDTH,
    height: MARSHMOOR_HEIGHT,
    tiles,
  };
}

export const marshmoor: BattleMap = buildMarshmoor();
