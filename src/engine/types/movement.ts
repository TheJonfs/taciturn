// MovementProfile — the computed spatial-capability descriptor a unit
// presents to the move engine.
// See docs/design/map-and-battlefield.md ("Movement profile").
//
// The profile is fully resolved (no optional fields except `specialMovement`)
// and immutable. Pathfinding and range calculations consume it directly
// without needing to know where its values came from.
//
// Composition rule (per ADR-0006):
// - `moveRange` and `jump` flow through `runModifyStatQuery` over a class
//   baseline; status / equipment / passive modifiers stack via that hook.
// - `terrainCosts`, `canEnter`, and `specialMovement` come straight from
//   the class baseline today. Their modifier surface (Float adding 'water'
//   to canEnter, Fly setting specialMovement, etc.) lands with session 5
//   when the first consumer abilities arrive.

import type { TerrainType } from './tile.ts';

export type SpecialMovementType = 'fly' | 'teleport' | 'phase';

export interface MovementProfile {
  readonly moveRange: number;
  readonly jump: number;
  readonly terrainCosts: ReadonlyMap<TerrainType, number>;
  readonly canEnter: ReadonlySet<TerrainType>;
  readonly specialMovement?: SpecialMovementType;
}
