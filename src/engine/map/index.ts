// Public API of src/engine/map.
// See docs/design/map-and-battlefield.md and ADR-0006.

export { tileAt, tilesAt, unitAt } from './accessors.ts';
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
export { arcTargetable, type ArcEndpoint } from './arc.ts';
export {
  addTerrainsWithTag,
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
