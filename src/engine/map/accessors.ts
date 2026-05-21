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
//
// Session 39a: permadead (`removed`) units no longer occupy any tile.
// Their `position` field is preserved for historical-log purposes but
// occupancy queries skip them — pathfinding sees the tile as empty,
// AoE selection misses them, and `unitAt` returns the next-best
// (typically undefined). KO'd-but-not-removed units still occupy.
export function unitAt(
  state: GameState,
  x: number,
  y: number,
  layer: number,
): Unit | undefined {
  assertInBounds(state.map, x, y);
  for (const unit of state.units.values()) {
    if (unit.removed) continue;
    const p = unit.position;
    if (p.x === x && p.y === y && p.layer === layer) return unit;
  }
  return undefined;
}

// A unit is KO'd when its current HP has hit zero (and it has not yet
// crossed the permadeath threshold into `removed`). Canonical predicate
// for the KO invariant per ADR-0074 — occupancy and turn-scheduling both
// key off it. A KO'd unit still *occupies* its tile (`unitAt` returns
// it) but does not *block* movement traversal (FFT canon: you may path
// through a downed unit, just not stop on it). `removed` units occupy
// nothing and so don't reach this predicate via `unitAt`.
export function isKO(unit: Unit): boolean {
  return unit.vitals.hp <= 0;
}
