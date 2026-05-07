// AoE shape — the pure data shape of an Area-of-Effect template.
// See docs/design/map-and-battlefield.md ("Area of effect").
//
// Lives in engine/types/ (alongside Position) so callers across the
// catalog tier (ability definitions reference shapes) and the map tier
// (aoeFootprint computes affected tiles) can both name the type without
// crossing layers. Algorithms (`shapeOffsets`, `aoeFootprint`) stay in
// `engine/map/aoe.ts`; only the type vocabulary lives here.

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
