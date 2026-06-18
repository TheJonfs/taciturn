// Straight-line targeting — line-of-sight check from a source endpoint
// to a target endpoint, considering `blocks_los` tiles along the path.
// See docs/design/map-and-battlefield.md ("Straight-line").
//
// v1 algorithm (a deliberate simplification — the design doc flags
// rasterization tie-breaking as TBD):
//
// 1. Rasterize the 2D path with Bresenham over (x, y).
// 2. For each cell *between* source and target (endpoints excluded),
//    interpolate the ray's elevation at that cell along the source→target
//    elevation gradient.
// 3. For each tile at that (x, y), at any layer, block when EITHER:
//    (a) the ray runs *below the tile's ground surface* (`ray <
//        tile.elevation`, strict) — terrain-mass occlusion, so a hill / mesa
//        between the endpoints blocks; or
//    (b) the ray passes through a barrier / `blocks_los` column's vertical
//        extent (`tile.elevation` ≤ ray < `tile.elevation + 1`; barriers
//        inclusive on the floor, columns strict-both-ends to graze-pass).
//
// Limits flagged for later refinement:
// - Bresenham can clip cell corners that a "supercover" trace would
//   include; some near-corner shots will pass that a stricter algorithm
//   would block. Acceptable for v1, revisit if game feel demands it.
// - Whether other units block LoS is *not* handled here; that's an
//   ability flag (`pierces_units` / `blocked_by_units` per the design
//   doc's open question), threaded in when the action layer lands.
// - Blocking columns are assumed 1 elevation unit tall. Tile properties
//   may eventually carry an explicit height parameter.
// - Terrain-mass occlusion applies per tile at (x, y) across *all* layers,
//   so on a future multi-layer map a ray passing *under* a bridge would read
//   as buried in the upper tile. v1 maps are effectively single-layer; a
//   layer-aware ray is the refinement if stacked maps land.

import { tilesAt } from './accessors.ts';
import { bresenhamCells } from './bresenham.ts';
import type { BattleMap, Tile } from '../types/index.ts';
import type { RangeEndpoint } from './range.ts';

const BLOCKS_LOS_PROPERTY = 'blocks_los';
const BLOCKER_HEIGHT = 1;

function tileBlocksAt(tile: Tile, rayElevation: number): boolean {
  // Terrain-mass occlusion (S69 follow-up): the ray is *strictly below* this
  // tile's ground surface → it is buried inside the terrain (a hill / raised
  // ground / mesa between the endpoints), so it blocks. Strict (`<`) is
  // load-bearing: a level shot across flat ground rides exactly at
  // `tile.elevation` (ray == surface) and must pass, and a shot that grazes a
  // smooth up/down slope rides the surface too. Only ground that *rises above*
  // the interpolated sightline occludes. This makes a tall hump between two
  // units block a straight-line shot the way intuition expects; previously
  // only barriers / `blocks_los` columns occluded and terrain mass was
  // transparent (you could shoot through a mountain). Endpoints are excluded
  // by the caller, so standing-on-a-cliff doesn't block your own shot.
  if (rayElevation < tile.elevation) return true;

  // Session 53: a Barrier blocks line-of-sight (Chris's call). Unlike a
  // `blocks_los` terrain column — which grazes-pass on a strict `>` floor so
  // a level shot over a same-height wall isn't blocked — a Barrier is a solid
  // object sitting *on* its tile surface: a wall between two same-elevation
  // units must block the eye-level ray. So a barrier uses an inclusive lower
  // bound (`>=`), a `blocks_los` tile keeps the strict `>`.
  if (tile.barrier !== undefined) {
    return rayElevation >= tile.elevation && rayElevation < tile.elevation + BLOCKER_HEIGHT;
  }
  if (!tile.properties.includes(BLOCKS_LOS_PROPERTY)) return false;
  // Strict on both sides — a ray exactly grazing the floor or ceiling of
  // a blocking column passes (lean toward "doesn't block").
  return rayElevation > tile.elevation && rayElevation < tile.elevation + BLOCKER_HEIGHT;
}

export function hasLineOfSight(
  map: BattleMap,
  source: RangeEndpoint,
  target: RangeEndpoint,
): boolean {
  const cells = bresenhamCells(source.x, source.y, target.x, target.y);
  // No intermediate cells: source==target or adjacent → trivially visible.
  if (cells.length <= 2) return true;

  const totalSteps = cells.length - 1;
  const elevationSpan = target.elevation - source.elevation;

  for (let i = 1; i < cells.length - 1; i++) {
    const cell = cells[i]!;
    const rayElevation = source.elevation + (elevationSpan * i) / totalSteps;
    // tilesAt would throw on out-of-bounds; the line is bounded by the
    // endpoints which are presumed in-bounds, so any cell on the path is
    // in-bounds too.
    const tilesHere = tilesAt(map, cell.x, cell.y);
    for (const tile of tilesHere) {
      if (tileBlocksAt(tile, rayElevation)) return false;
    }
  }
  return true;
}
