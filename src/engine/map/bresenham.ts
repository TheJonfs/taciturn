// Bresenham rasterization over (x, y) — the shared 2D line walker for the
// map's sight/lob traces. Used by both straight-line LoS (`line-of-sight.ts`)
// and arc clearance (`arc.ts`) so the two sample the same cells.

export interface Cell {
  readonly x: number;
  readonly y: number;
}

// Bresenham over (x, y), inclusive of endpoints. Single-pass; no allocations
// beyond the result array.
export function bresenhamCells(x0: number, y0: number, x1: number, y1: number): ReadonlyArray<Cell> {
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
