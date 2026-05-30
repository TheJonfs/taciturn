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
// 3. For each `blocks_los` tile at that (x, y), at any layer, check
//    whether the ray's elevation passes through the tile's vertical
//    extent (`tile.elevation` ≤ ray ≤ `tile.elevation + 1`, exclusive
//    on both ends — leaning toward "doesn't block" on grazing).
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

import { tilesAt } from './accessors.ts';
import type { BattleMap, Tile } from '../types/index.ts';
import type { RangeEndpoint } from './range.ts';

const BLOCKS_LOS_PROPERTY = 'blocks_los';
const BLOCKER_HEIGHT = 1;

interface Cell {
  readonly x: number;
  readonly y: number;
}

// Bresenham over (x, y), inclusive of endpoints. Single-pass; no
// allocations beyond the result array.
function bresenhamCells(x0: number, y0: number, x1: number, y1: number): ReadonlyArray<Cell> {
  const cells: Cell[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  // Loose safety bound — straight lines on a v1 map cap at width+height.
  // The break-on-endpoint check is the real terminator.
  for (let i = 0; i <= dx + dy + 1; i++) {
    cells.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

function tileBlocksAt(tile: Tile, rayElevation: number): boolean {
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
