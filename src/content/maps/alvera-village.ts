// Alvera Village — the Chapter 1 node-2 battlefield (S96, Chris's grid).
//
// Spec: `docs/maps/alvera-village.md` (v1.0). The grid below is Chris's
// elevation data verbatim. 16×16 — plus the game's FIRST multi-layer
// feature, the western bridge deck (see BRIDGE_DECK below).
//
// Theme: a riverside village. Elevation-8 tiles are BUILDING WALLS —
// ordinary ground tiles so tall (5-6 above the streets) that no jump
// crosses them; buildings read as solid architecture with elev-3
// interiors reached through door gaps:
//   - NW manor (x0-5, y0-3), south door at (2,3).
//   - SW house (x0-4, y11-15), east door at (4,13).
//   - South-central house (x6-10, y12-15), north door at (8,12).
//   - SE house (x12-15, y11-15), west door at (12,13).
// Streets: the east-west road at row 10 (all elev 2) and two
// north-south lanes at cols 5 and 11 between the southern houses.
//
// The river: a diagonal channel of deep water runs from the NE corner
// southwest — (15,0) stepping down to (8,7) — into the east-west deep
// channel at row 8 (x0-8), with shallow fringes alongside. The row-8
// channel is wadeable (shallow row 7 → deep row 8 → shallow row 9);
// the east bank (row 8, x11+) walks around dry. The NE triangle beyond
// the diagonal rises to a SE shelf that connects down the east edge.
//
// Terrain conventions follow the universal water-table rule (per
// `docs/maps/river-ridge.md` and ADR-0073):
//   elev 0  → water_deep
//   elev 1  → water_shallow
//   elev ≥2 → ground
//
// Deployment zones live beside the terrain (S70): see
// `src/content/deployment/registry.ts` (`alvera_village` → `default`).
// Blue (player) on the village road cols 6-11 / rows 10-11; Red (enemy)
// in the NW fields cols 1-4 / rows 4-6, across the row-8 river — the
// engagement is a ford assault on the village.

import type { BattleMap, Tile } from '@engine/index.ts';

export const ALVERA_VILLAGE_WIDTH = 16;
export const ALVERA_VILLAGE_HEIGHT = 16;

// Chris's elevation grid, rows y=0 (first) through y=15 (last), columns
// x=0 (west) through x=15 (east).
const ELEVATION_GRID: ReadonlyArray<ReadonlyArray<number>> = [
  // y=0 — NW manor north wall; river mouth at the NE corner
  [8, 8, 8, 8, 8, 8, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0],
  // y=1 — manor interior begins
  [8, 3, 3, 3, 3, 8, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0],
  // y=2
  [8, 3, 3, 3, 3, 8, 3, 3, 3, 2, 2, 1, 1, 0, 0, 1],
  // y=3 — manor south wall with the door gap at x=2
  [8, 8, 3, 8, 8, 8, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1],
  // y=4 — NW fields
  [3, 2, 2, 2, 3, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1, 2],
  // y=5
  [3, 2, 2, 2, 3, 3, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2],
  // y=6
  [2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 3],
  // y=7 — north ford (shallow)
  [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 2, 2, 3, 3],
  // y=8 — the deep east-west channel (x0-8); dry east bank from x11
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 3],
  // y=9 — south ford (shallow)
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
  // y=10 — the east-west road
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  // y=11 — SW + SE house north walls; the road spans x5-11
  [8, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8],
  // y=12 — south-central house north wall with the door gap at x=8
  [8, 3, 3, 3, 8, 2, 8, 8, 3, 8, 8, 2, 8, 3, 3, 8],
  // y=13 — SW east door (x4), SE west door (x12)
  [8, 3, 3, 3, 3, 2, 8, 3, 3, 3, 8, 2, 3, 3, 3, 8],
  // y=14
  [8, 3, 3, 3, 8, 2, 8, 3, 3, 3, 8, 2, 8, 3, 3, 8],
  // y=15 — south walls; the two lanes (x5, x11) reach the map edge
  [8, 8, 8, 8, 8, 2, 8, 8, 8, 8, 8, 2, 8, 8, 8, 8],
];

function terrainFromElevation(elev: number): string {
  if (elev === 0) return 'water_deep';
  if (elev === 1) return 'water_shallow';
  // S96 (Chris): every elev-8 tile in Alvera is a building wall — dressed
  // stone, the Stonebridge keep's `rampart` terrain (art authored S47).
  // Land-tagged and enterable in principle, unreachable by jump in practice
  // (5-6 above the streets) — identical semantics to Stonebridge's walls.
  if (elev === 8) return 'rampart';
  return 'ground';
}

// S96 (bridges, ADR-0155) — the WESTERN BRIDGE: the game's first layer-1
// deck, spanning the river between the NW manor and the SW house. Three
// deck tiles at x=2 cross the shallow-deep-shallow band (y=7-9) at
// elevation 3 — one step up from the elev-2 approaches at (2,6) and
// (2,10), and exactly BRIDGE_MIN_CLEARANCE above each under-tile
// (shallow 1 / deep 0 / shallow 1). Destroying a span (Pit, or a ram
// from below) dumps its occupant into the river. A second bridge may
// join later; this one is the experiment.
const BRIDGE_DECK: ReadonlyArray<{ x: number; y: number }> = [
  { x: 2, y: 7 },
  { x: 2, y: 8 },
  { x: 2, y: 9 },
];
const BRIDGE_DECK_ELEVATION = 3;

// S97 (bridge art kit): the southern RAMP — a layer-0 bridge-terrain
// tile on the elev-2 approach at (2, 10). The deck's visual lift shifts
// span art up-left, which seats the NORTH end on its bank but pulls the
// SOUTH end off its bank; extending the bridge-terrain chain one cell
// onto dry ground gives the span a rising approach piece to land on
// (Chris's call). Purely a terrain swap: single standing place, layer
// 0, bank elevation — NOT a stacked cell, no clearance implications.
// The art-kit selection rule reads the chain and puts the rise_n piece
// here while (2, 9) above the river flattens.
const BRIDGE_RAMP: ReadonlyArray<{ x: number; y: number }> = [{ x: 2, y: 10 }];

function buildAlveraVillage(): BattleMap {
  const tiles: Tile[] = [];
  for (let y = 0; y < ALVERA_VILLAGE_HEIGHT; y++) {
    const row = ELEVATION_GRID[y]!;
    for (let x = 0; x < ALVERA_VILLAGE_WIDTH; x++) {
      const elev = row[x]!;
      const isRamp = BRIDGE_RAMP.some((r) => r.x === x && r.y === y);
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: elev,
        terrain: isRamp ? 'bridge' : terrainFromElevation(elev),
        properties: [],
      });
    }
  }
  for (const d of BRIDGE_DECK) {
    tiles.push({
      x: d.x,
      y: d.y,
      layer: 1,
      elevation: BRIDGE_DECK_ELEVATION,
      terrain: 'bridge',
      properties: [],
    });
  }
  return {
    width: ALVERA_VILLAGE_WIDTH,
    height: ALVERA_VILLAGE_HEIGHT,
    tiles,
  };
}

export const alveraVillage: BattleMap = buildAlveraVillage();
