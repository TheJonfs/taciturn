// Area of effect — shape definitions and footprint resolution.
// See docs/design/map-and-battlefield.md ("Area of effect").
//
// An AoE is parameterized by:
// - shape: a 2D footprint of (dx, dy) offsets relative to an anchor
// - anchor: an (x, y, elevation) — supplied by the caller, since
//   "where the anchor sits" depends on the action's targeting mode
//   (target tile, source tile, line endpoint, etc.) — that resolution
//   lands with the action layer in session 7
// - vertical tolerance: max |elevation differential| from the anchor's
//   elevation that an affected tile may have
//
// The footprint is the *set of map tiles* (potentially multi-layer at a
// given (x, y)) that the shape covers. Default rule from the design doc:
// when multiple tiles at the same (x, y) qualify within vertical
// tolerance, all qualifying tiles are affected — a fireball can hit
// both the unit on the ground and the unit on the bridge above.
//
// Shapes implemented this session: single tile, diamond (Manhattan
// radius), square (Chebyshev radius), cross (cardinal arms of length N),
// and custom (caller-supplied offset list). Line and cone are deferred
// — both depend on directional anchor semantics that fully arrive with
// the action layer; flagged for the next session that authors a
// directional ability.

import { tilesAt } from './accessors.ts';
import type { BattleMap, Tile } from '../types/index.ts';

export interface AoeOffset {
  readonly dx: number;
  readonly dy: number;
}

export type AoeShape =
  | { readonly kind: 'tile' }
  | { readonly kind: 'diamond'; readonly radius: number }
  | { readonly kind: 'square'; readonly radius: number }
  | { readonly kind: 'cross'; readonly radius: number }
  | { readonly kind: 'custom'; readonly offsets: ReadonlyArray<AoeOffset> };

export interface AoeAnchor {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

// Resolve a shape into its relative-coordinate set. Stable enumeration
// (radius outward, row-major) so the result is deterministic for tests.
export function shapeOffsets(shape: AoeShape): ReadonlyArray<AoeOffset> {
  switch (shape.kind) {
    case 'tile':
      return [{ dx: 0, dy: 0 }];
    case 'diamond': {
      const out: AoeOffset[] = [];
      for (let dy = -shape.radius; dy <= shape.radius; dy++) {
        for (let dx = -shape.radius; dx <= shape.radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= shape.radius) out.push({ dx, dy });
        }
      }
      return out;
    }
    case 'square': {
      const out: AoeOffset[] = [];
      for (let dy = -shape.radius; dy <= shape.radius; dy++) {
        for (let dx = -shape.radius; dx <= shape.radius; dx++) {
          out.push({ dx, dy });
        }
      }
      return out;
    }
    case 'cross': {
      const out: AoeOffset[] = [{ dx: 0, dy: 0 }];
      for (let r = 1; r <= shape.radius; r++) {
        out.push({ dx: r, dy: 0 });
        out.push({ dx: -r, dy: 0 });
        out.push({ dx: 0, dy: r });
        out.push({ dx: 0, dy: -r });
      }
      return out;
    }
    case 'custom':
      return shape.offsets;
  }
}

export interface AoeFootprintArgs {
  readonly map: BattleMap;
  readonly anchor: AoeAnchor;
  readonly shape: AoeShape;
  readonly verticalTolerance: number;
}

// Returns every map tile inside the shape's footprint whose elevation
// is within `verticalTolerance` of the anchor's elevation. Out-of-bounds
// offsets (off the edge of the map) are silently skipped — an AoE
// rendered at the corner of a map naturally clips. (Distinct from
// accessor calls where out-of-bounds is a programmer error: here, the
// shape extent is calculated, not asked for.)
export function aoeFootprint(args: AoeFootprintArgs): ReadonlyArray<Tile> {
  const { map, anchor, shape, verticalTolerance } = args;
  const offsets = shapeOffsets(shape);
  const result: Tile[] = [];
  for (const off of offsets) {
    const x = anchor.x + off.dx;
    const y = anchor.y + off.dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    const tilesHere = tilesAt(map, x, y);
    for (const tile of tilesHere) {
      if (Math.abs(tile.elevation - anchor.elevation) <= verticalTolerance) {
        result.push(tile);
      }
    }
  }
  return result;
}
