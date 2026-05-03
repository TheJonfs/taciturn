// Spatial accessors per ADR-0002.
//
// These are the first consumers of `OutOfBoundsError`: bounds-checking
// happens here, not at every call site. Within bounds, `tilesAt` is
// always answerable (possibly empty); `tileAt` and `unitAt` may
// legitimately return `undefined`.
//
// Cost: each call is O(N) over `map.tiles` / O(units) over the unit
// map. With v1 map sizes (~20×20 = 400 tiles, ~20 units), this is
// trivially small even when called per-step from pathfinding. Spatial
// indexing is a known later-stage concern; flagged in handoff if
// profiling shows a hotspot.

import { OutOfBoundsError } from '../types/index.ts';
import type { BattleMap, GameState, Tile, Unit } from '../types/index.ts';

function assertInBounds(map: BattleMap, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    throw new OutOfBoundsError(x, y, map.width, map.height);
  }
}

// Every tile at (x, y), across all layers, in undefined order.
// Returns `[]` when no tile exists at that coordinate (a gap in the map).
// Throws `OutOfBoundsError` when (x, y) is outside the map.
export function tilesAt(map: BattleMap, x: number, y: number): ReadonlyArray<Tile> {
  assertInBounds(map, x, y);
  return map.tiles.filter((t) => t.x === x && t.y === y);
}

// The single tile at (x, y, layer), or `undefined` when no tile exists
// at that exact position.
// Throws `OutOfBoundsError` when (x, y) is outside the map.
export function tileAt(
  map: BattleMap,
  x: number,
  y: number,
  layer: number,
): Tile | undefined {
  assertInBounds(map, x, y);
  return map.tiles.find((t) => t.x === x && t.y === y && t.layer === layer);
}

// The unit standing at (x, y, layer), or `undefined` when none.
// Throws `OutOfBoundsError` when (x, y) is outside the map.
//
// Per core-types.md, `unit.position` is the single source of truth for
// occupancy; tiles do not store it.
export function unitAt(
  state: GameState,
  x: number,
  y: number,
  layer: number,
): Unit | undefined {
  assertInBounds(state.map, x, y);
  for (const unit of state.units.values()) {
    const p = unit.position;
    if (p.x === x && p.y === y && p.layer === layer) return unit;
  }
  return undefined;
}
