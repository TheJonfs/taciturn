// Authoring helpers for deployment-zone configs.
//
// Session 70: zones are authored as explicit tile-sets now (no longer a
// per-tile map field). `rect` is the common case — an inclusive
// rectangular block of positions on a single layer, matching how the
// three original maps described their zones ("rows a-b, cols c-d").

import type { Position } from '@engine/index.ts';

// Inclusive rectangle of positions: x in [x0, x1], y in [y0, y1].
export function rect(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  layer = 0,
): Position[] {
  const tiles: Position[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({ x, y, layer });
    }
  }
  return tiles;
}
