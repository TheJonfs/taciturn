// Public API of src/engine/map.
// See docs/design/map-and-battlefield.md and ADR-0006.

export { tileAt, tilesAt, unitAt, isKO } from './accessors.ts';
export { computeMovementProfile } from './movement-profile.ts';
export {
  getLegalMoves,
  positionKey,
  SpecialMovementNotImplementedError,
  type MovePath,
  type MovementResult,
  type PositionKey,
} from './pathfinding.ts';
export {
  endpointFrom,
  horizontalDistance,
  inRange,
  verticalDistance,
  type RangeEndpoint,
  type RangeParams,
} from './range.ts';
export { hasLineOfSight } from './line-of-sight.ts';
export { FALLING_DAMAGE_PER_LEVEL, fallDamageAction } from './fall-damage.ts';
export {
  applyKnockback,
  type KnockbackArgs,
  type KnockbackCancellation,
  type KnockbackDirection,
  type KnockbackResult,
} from './knockback.ts';
export { arcTargetable, type ArcEndpoint } from './arc.ts';
export {
  addTerrainsWithTag,
  mapAllTerrainCosts,
  mapTerrainCostsByTag,
  terrainHasTag,
  terrainsWithTag,
  type TerrainRegistry,
  type TerrainTag,
} from './terrain-registry.ts';
export {
  assertMapValid,
  MapValidationError_Throw,
  validateMap,
  type MapValidationError,
  type MapValidationOptions,
  type MapValidationResult,
} from './map-validator.ts';
export {
  aoeFootprint,
  cardinalFromTo,
  enlargeAoeShape,
  shapeOffsets,
  type AoeAnchor,
  type AoeFootprintArgs,
  type AoeOffset,
  type AoeShape,
} from './aoe.ts';
