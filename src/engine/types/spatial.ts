// Spatial primitives: facing direction and grid position.
// See docs/design/core-types.md and docs/design/map-and-battlefield.md.

export type Direction = 'N' | 'E' | 'S' | 'W';

export interface Position {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}
