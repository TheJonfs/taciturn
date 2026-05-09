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
// - direction: required for directional shapes (cone). Other shapes are
//   rotation-symmetric and ignore the field.
//
// The footprint is the *set of map tiles* (potentially multi-layer at a
// given (x, y)) that the shape covers. Default rule from the design doc:
// when multiple tiles at the same (x, y) qualify within vertical
// tolerance, all qualifying tiles are affected — a fireball can hit
// both the unit on the ground and the unit on the bridge above.
//
// Shapes implemented: single tile, diamond (Manhattan radius), square
// (Chebyshev radius), cross (cardinal arms of length N), cone
// (directional, caster-anchored — rows[i] is the width at distance i+1),
// and custom (caller-supplied offset list). Line is still deferred until
// a content consumer ships.

import { tilesAt } from './accessors.ts';
import type {
  AoeAnchor,
  AoeOffset,
  AoeShape,
  BattleMap,
  CardinalDirection,
  Tile,
} from '../types/index.ts';

// Re-export the shape vocabulary so existing callers that import from
// `engine/map/aoe.ts` keep working. The canonical home for the types
// is `engine/types/aoe-shape.ts`; only the algorithms are owned here.
export type { AoeAnchor, AoeOffset, AoeShape, CardinalDirection };

// Per-direction (forward, lateral) basis vectors. Forward is "into the
// cone"; lateral is "across the cone" (perpendicular to forward). For a
// cone facing N (forward = -y), forward = (0, -1) and lateral = (1, 0)
// — moving lateral steps the row left/right in screen space.
const DIRECTION_BASIS: Record<
  CardinalDirection,
  { readonly forward: { dx: number; dy: number }; readonly lateral: { dx: number; dy: number } }
> = {
  N: { forward: { dx: 0, dy: -1 }, lateral: { dx: 1, dy: 0 } },
  S: { forward: { dx: 0, dy: 1 }, lateral: { dx: 1, dy: 0 } },
  E: { forward: { dx: 1, dy: 0 }, lateral: { dx: 0, dy: 1 } },
  W: { forward: { dx: -1, dy: 0 }, lateral: { dx: 0, dy: 1 } },
};

// Resolve a shape into its relative-coordinate set. Stable enumeration
// (radius outward, row-major) so the result is deterministic for tests.
//
// `direction` is required for directional shapes (cone) — passing it as
// `undefined` for a cone throws. Symmetric shapes (tile/diamond/square/
// cross/custom) ignore the parameter; the default `'N'` keeps existing
// callers' shape unchanged.
export function shapeOffsets(
  shape: AoeShape,
  direction: CardinalDirection = 'N',
): ReadonlyArray<AoeOffset> {
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
    case 'cone': {
      const basis = DIRECTION_BASIS[direction];
      const out: AoeOffset[] = [];
      for (let i = 0; i < shape.rows.length; i++) {
        const width = shape.rows[i]!;
        if (!Number.isInteger(width) || width <= 0 || width % 2 === 0) {
          throw new Error(
            `shapeOffsets: cone row ${i} has invalid width ${width}; must be a positive odd integer`,
          );
        }
        const forwardSteps = i + 1;
        const half = (width - 1) / 2;
        for (let lat = -half; lat <= half; lat++) {
          out.push({
            dx: basis.forward.dx * forwardSteps + basis.lateral.dx * lat,
            dy: basis.forward.dy * forwardSteps + basis.lateral.dy * lat,
          });
        }
      }
      return out;
    }
    case 'line': {
      // Cardinal line: `length` offsets along the forward axis, starting
      // one tile in front of the caster. Kinematic-stop semantics (a wall
      // ending the line early) live in `aoeFootprint`; `shapeOffsets`
      // returns the unconstrained offset list for callers that want the
      // full theoretical footprint (e.g., UI preview before terrain
      // blocking is applied).
      if (!Number.isInteger(shape.length) || shape.length <= 0) {
        throw new Error(
          `shapeOffsets: line length ${shape.length} must be a positive integer`,
        );
      }
      const basis = DIRECTION_BASIS[direction];
      const out: AoeOffset[] = [];
      for (let step = 1; step <= shape.length; step++) {
        out.push({ dx: basis.forward.dx * step, dy: basis.forward.dy * step });
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
  // Required for directional shapes (cone). Optional / ignored for
  // symmetric shapes. Defaults to `'N'` so existing callers continue to
  // work without modification.
  readonly direction?: CardinalDirection;
}

// Returns every map tile inside the shape's footprint whose elevation
// is within `verticalTolerance` of the anchor's elevation. Out-of-bounds
// offsets (off the edge of the map) are silently skipped — an AoE
// rendered at the corner of a map naturally clips. (Distinct from
// accessor calls where out-of-bounds is a programmer error: here, the
// shape extent is calculated, not asked for.)
//
// Per ADR-0031, the `'line'` shape uses kinematic-stop semantics: the
// loop iterates forward from the anchor and terminates on encountering
// a tile whose elevation differs from the anchor's by more than
// `verticalTolerance`. Tiles past that wall are excluded. Other shapes
// (diamond/square/cross/cone/custom) keep the per-tile-filter behavior
// — an explosion ignores walls per-tile, while a line is a beam that
// stops on a wall.
export function aoeFootprint(args: AoeFootprintArgs): ReadonlyArray<Tile> {
  const { map, anchor, shape, verticalTolerance, direction } = args;

  if (shape.kind === 'line') {
    return lineFootprint(map, anchor, shape, verticalTolerance, direction ?? 'N');
  }

  const offsets = shapeOffsets(shape, direction);
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

// Kinematic-stop line footprint (per ADR-0031). Iterates forward from
// the anchor; on the first step that's out of bounds OR has no in-tolerance
// tile, the line terminates. Tiles past that point are excluded.
function lineFootprint(
  map: BattleMap,
  anchor: AoeAnchor,
  shape: { readonly kind: 'line'; readonly length: number },
  verticalTolerance: number,
  direction: CardinalDirection,
): ReadonlyArray<Tile> {
  if (!Number.isInteger(shape.length) || shape.length <= 0) {
    throw new Error(
      `lineFootprint: line length ${shape.length} must be a positive integer`,
    );
  }
  const basis = DIRECTION_BASIS[direction];
  const result: Tile[] = [];
  for (let step = 1; step <= shape.length; step++) {
    const x = anchor.x + basis.forward.dx * step;
    const y = anchor.y + basis.forward.dy * step;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) break; // off the map → stop
    const tilesHere = tilesAt(map, x, y);
    const inTolerance = tilesHere.filter(
      (tile) => Math.abs(tile.elevation - anchor.elevation) <= verticalTolerance,
    );
    if (inTolerance.length === 0) break; // wall → stop, no tiles past this point
    for (const tile of inTolerance) result.push(tile);
  }
  return result;
}

// Compute the dominant cardinal direction from `from` → `to`. Used by
// the AoE dispatcher when a directional shape (cone, line) needs an
// orientation derived from caster→target geometry.
//
// Tie-breaking when `|dx| === |dy|`: prefer horizontal (E/W) over
// vertical (N/S). The cardinal-only constraint means a perfect-diagonal
// target snaps to one of the four axes; the choice is arbitrary as long
// as it's stable. Same-position from/to also returns `'N'` arbitrarily
// — the caller should validate before reaching this (a caster can't
// fire a cone at their own tile).
export function cardinalFromTo(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): CardinalDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) return 'E';
    if (dx < 0) return 'W';
    return 'N'; // dx === 0 && dy === 0; arbitrary stable choice
  }
  return dy > 0 ? 'S' : 'N';
}

// Per ADR-0031: universal "+1 step" AoE expansion rule. Returns the
// shape grown by one parameter for parameterized shapes; cone and
// custom shapes pass through unchanged (no canonical growth rule).
//
// Used by Aether Bloom (Fire Mage Support, free for Fire) — registers
// `modifyAoeShape` and applies this transform to magical AoE casts.
// Composes naturally with chained expanders: two stacked passives both
// calling `enlargeAoeShape` produce `+2 step` growth.
//
// Specifically:
//   - tile             → cross r1 (smallest spread; tile has no radius)
//   - diamond r=N      → diamond r=N+1
//   - square r=N       → square r=N+1
//   - cross r=N        → cross r=N+1
//   - line length=N    → line length=N+1
//   - cone rows=[…]    → unchanged (cones are author-defined; future
//                        cone-extender content can ship its own helper)
//   - custom offsets=[…] → unchanged (custom is author-defined; no rule)
export function enlargeAoeShape(shape: AoeShape): AoeShape {
  switch (shape.kind) {
    case 'tile':
      return { kind: 'cross', radius: 1 };
    case 'diamond':
      return { kind: 'diamond', radius: shape.radius + 1 };
    case 'square':
      return { kind: 'square', radius: shape.radius + 1 };
    case 'cross':
      return { kind: 'cross', radius: shape.radius + 1 };
    case 'line':
      return { kind: 'line', length: shape.length + 1 };
    case 'cone':
    case 'custom':
      return shape;
  }
}
