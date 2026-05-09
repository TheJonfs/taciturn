// AoE shape — the pure data shape of an Area-of-Effect template.
// See docs/design/map-and-battlefield.md ("Area of effect").
//
// Lives in engine/types/ (alongside Position) so callers across the
// catalog tier (ability definitions reference shapes) and the map tier
// (aoeFootprint computes affected tiles) can both name the type without
// crossing layers. Algorithms (`shapeOffsets`, `aoeFootprint`) stay in
// `engine/map/aoe.ts`; only the type vocabulary lives here.

import type { Direction } from './spatial.ts';

export interface AoeOffset {
  readonly dx: number;
  readonly dy: number;
}

// Cone shape — caster-anchored directional AoE. `rows[i]` is the width
// (in tiles, must be odd) at distance i+1 from the caster. The cone is
// symmetric around the forward axis, so e.g. `rows: [1, 3, 3]` produces
// 1 tile at distance 1, 3 tiles at distance 2, 3 tiles at distance 3
// (7 tiles total). Even widths are rejected by `shapeOffsets` since the
// cone has no canonical center for them.
//
// The cone's *direction* is supplied at footprint-resolution time
// (caster→target-tile cardinal), not stored on the shape — the same
// cone definition rotates to point at whatever the caster picks. See
// `aoeFootprint` for the direction parameter.
// Line shape — caster-anchored cardinal projectile/beam. Projects forward
// `length` tiles from the caster's tile (the caster's tile itself is not
// included). Direction is supplied at footprint-resolution time, derived
// from caster→target geometry via `cardinalFromTo`.
//
// Vertical handling for line is *kinematic* (per ADR-0031): `aoeFootprint`
// iterates forward from the caster and terminates on the first tile whose
// elevation differs from the caster's by more than `verticalTolerance`.
// Tiles past that wall are not included even if their individual elevation
// would pass tolerance. The per-tile-filter behavior used by spread shapes
// (diamond/square/cross/cone/custom) is the wrong model for a line, where
// a wall in the middle of the path should block the line's continuation.
//
// v1 ships cardinal-only lines (8-direction is deferred). The dispatcher
// (in `resolveAbilityTargets`) requires `anchorMode: 'caster'` for line —
// matching cones — and throws on misuse.
export type AoeShape =
  | { readonly kind: 'tile' }
  | { readonly kind: 'diamond'; readonly radius: number }
  | { readonly kind: 'square'; readonly radius: number }
  | { readonly kind: 'cross'; readonly radius: number }
  | { readonly kind: 'cone'; readonly rows: ReadonlyArray<number> }
  | { readonly kind: 'line'; readonly length: number }
  | { readonly kind: 'custom'; readonly offsets: ReadonlyArray<AoeOffset> };

export interface AoeAnchor {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

// Re-export Direction under the AoE-vocabulary name. Cone uses the same
// 4-cardinal set as facing and knockback; centralizing the type avoids
// per-module redefinitions. Direction is N=−y, S=+y, E=+x, W=−x.
export type CardinalDirection = Direction;
