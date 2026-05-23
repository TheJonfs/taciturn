// Stonebridge — the second authored Mage War battlefield (Session 47).
//
// Spec: `docs/maps/stonebridge.md` (v1.0). The grid below is the S47
// brief's "Elevation Grid" verbatim. 16×16 single layer.
//
// Terrain conventions follow the universal water-table rule (per
// `docs/maps/river-ridge.md` and ADR-0073):
//   elev 0  → water_deep
//   elev 1  → water_shallow
//   elev ≥2 → ground, with one exception:
//
// The SE building's keep walls are a new terrain type `rampart` (ADR-0073
// extension, Session 47). Behaves as ground at elev 8 for pathfinding
// and combat — every class can step onto a rampart at the ruleset's
// default step cost — but the distinct terrain id carries content
// identity for the renderer (rampart art is authored separately).
// Rampart tiles are 9 specific positions enclosing the building's
// north/west/south walls; corner hills at elev 8 (top-left, bottom-
// left of the map) remain `ground` (they're hills, not architecture).
//
// Deployment zones per S47 brief D7:
//   North zone (team_a / Blue): rows 0-1, cols 5-8 (8 tiles)
//   South zone (team_b / Red):  rows 14-15, cols 5-8 (8 tiles)
//
// All deployment tiles are flat ground (elev 2). 8 tiles per side
// supports the v1 4v4 Mage War mode with 4 placement slots + 4 extras.

import type { BattleMap, TeamId, Tile } from '@engine/index.ts';
import { teamId } from '@engine/index.ts';

export const STONEBRIDGE_WIDTH = 16;
export const STONEBRIDGE_HEIGHT = 16;

const TEAM_BLUE: TeamId = teamId('team_a');
const TEAM_RED: TeamId = teamId('team_b');

// Per the S47 brief's elevation grid. Rows are y=0 (first, "north" by
// canvas convention) through y=15 (last, "south"). The brief printed
// the grid with y=0 at the top; this array stores the same.
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0  — NW corner hill (elev 8 → 5 stepping down to flat plain)
  [8, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=1
  [7, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=2
  [5, 5, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=3  — flat plain
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=4  — river's north bank starts; bridge piers begin at cols 6-7
  [1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1],
  // y=5
  [1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 2, 1],
  // y=6  — deep channel mid-river; bridge climbs (elev 5 across span)
  [0, 1, 1, 0, 0, 0, 5, 5, 0, 0, 0, 0, 2, 0, 2, 0],
  // y=7
  [0, 1, 0, 0, 0, 0, 6, 6, 0, 0, 0, 2, 2, 0, 0, 0],
  // y=8  — bridge peak (elev 6, mid-span)
  [0, 0, 1, 0, 0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0],
  // y=9
  [0, 1, 1, 0, 0, 0, 5, 5, 0, 0, 0, 2, 2, 0, 2, 0],
  // y=10
  [1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 2, 1, 2, 1],
  // y=11 — river's south bank
  [1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1],
  // y=12 — flat plain, building's north wall at cols 10-15 (rampart elev 8)
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 8, 8],
  // y=13 — building west wall at col 10 (rampart); interior cols 11-14;
  //        col 15 reads back to the ridge tier (elev 6)
  [5, 5, 5, 3, 2, 2, 2, 2, 2, 2, 8, 2, 2, 2, 2, 6],
  // y=14 — interior ground at col 10 (the gate — single-tile opening
  //        in the west wall); col 15 ridge tier (elev 4)
  [7, 7, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4],
  // y=15 — SW corner hill (elev 8 → 5); building south wall at cols
  //        10-11 (rampart elev 8); cols 12-15 interior ground
  [8, 7, 5, 3, 2, 2, 2, 2, 2, 2, 8, 8, 2, 2, 2, 2],
];

// Rampart positions — the 9 tiles forming the SE building's walls.
// Elev 8 corner hills at (0, 0) and (0, 15) are NOT included; those are
// natural terrain. See the file header for the wall layout.
const RAMPART_POSITIONS: ReadonlySet<string> = new Set([
  // North wall (row 12, cols 10-15)
  '12,10', '12,11', '12,12', '12,13', '12,14', '12,15',
  // West wall — (13, 10) and (15, 10); row 14 col 10 is the gate
  '13,10',
  // South wall (row 15, cols 10-11)
  '15,10', '15,11',
]);

function terrainFromTile(x: number, y: number, elev: number): string {
  if (RAMPART_POSITIONS.has(`${y},${x}`)) return 'rampart';
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  return 'ground';
}

// Deployment-zone author rule per S47 brief D7:
//   North (Blue): rows 0-1, cols 5-8 (8 tiles)
//   South (Red):  rows 14-15, cols 5-8 (8 tiles)
function deploymentZoneFor(x: number, y: number): TeamId | undefined {
  const inZoneCols = x >= 5 && x <= 8;
  if (!inZoneCols) return undefined;
  if (y >= 0 && y <= 1) return TEAM_BLUE;
  if (y >= 14 && y <= 15) return TEAM_RED;
  return undefined;
}

function buildStonebridge(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < STONEBRIDGE_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < STONEBRIDGE_WIDTH; x++) {
      const elev = row[x]!;
      const zone = deploymentZoneFor(x, y);
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: elev,
        terrain: terrainFromTile(x, y, elev),
        properties: [],
        ...(zone !== undefined ? { deploymentZone: zone } : {}),
      });
    }
  }
  return {
    width: STONEBRIDGE_WIDTH,
    height: STONEBRIDGE_HEIGHT,
    tiles,
  };
}

export const stonebridge: BattleMap = buildStonebridge();
