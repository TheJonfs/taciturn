// Map validator — load-time sanity checks for authored maps.
// See ADR-0073 and `docs/maps/river-ridge.md`.
//
// Validation is intentionally minimal in v1: catch the kinds of typos
// content authors make (terrain string not in the registry, coordinates
// out of range) before they surface as confusing pathfinding failures
// mid-battle.
//
// Session 70: deployment-zone coverage moved out of here — zones now live
// beside the terrain (see `deployment-zone.ts` / `validateDeployment
// Zones`). `validateMap` validates terrain geometry only.
//
// Pure function. Returns a structured error list; callers decide
// whether to throw (production load) or surface for tooling (a future
// map-authoring CLI). The default ruleset and battle bootstrap call
// `validateMap` strictly so authoring slips fail loud.
//
// Out of scope:
//   - Reachability / non-isolation. Authored maps may legitimately
//     contain unreachable zones (locked-off areas, scenery islands).
//     If gameplay needs reachability, an ability-specific check
//     belongs at the pathfinding layer.
//   - Layer consistency. v1 single-layer; multi-layer rules land when
//     bridges / multi-floor features arrive.
//   - Elevation upper bound. The river-ridge spec uses 0-9; nothing in
//     the engine enforces a ceiling, so the validator stays open-ended
//     on that. A ruleset-level cap can land if needed.

import type { BattleMap } from '../types/index.ts';
import type { TerrainRegistry } from './terrain-registry.ts';

export interface MapValidationError {
  // Machine-readable code for tooling; the message is the human read.
  readonly code:
    | 'unknown_terrain'
    | 'tile_out_of_bounds'
    | 'duplicate_tile_position'
    | 'negative_elevation';
  readonly message: string;
}

export interface MapValidationResult {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<MapValidationError>;
}

export function validateMap(
  map: BattleMap,
  registry: TerrainRegistry,
): MapValidationResult {
  const errors: MapValidationError[] = [];

  const seenPositions = new Set<string>();

  for (const tile of map.tiles) {
    // Bounds check.
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) {
      errors.push({
        code: 'tile_out_of_bounds',
        message: `Tile at (${tile.x}, ${tile.y}, layer ${tile.layer}) is outside map bounds (${map.width}×${map.height}).`,
      });
      continue;
    }

    // Duplicate-position check (same x,y,layer twice).
    const posKey = `${tile.x},${tile.y},${tile.layer}`;
    if (seenPositions.has(posKey)) {
      errors.push({
        code: 'duplicate_tile_position',
        message: `Duplicate tile at (${tile.x}, ${tile.y}, layer ${tile.layer}).`,
      });
    } else {
      seenPositions.add(posKey);
    }

    // Elevation sanity: negative values are programmer errors, not
    // legitimate authoring. (Below-zero elevations break the universal
    // water-table convention.)
    if (tile.elevation < 0) {
      errors.push({
        code: 'negative_elevation',
        message: `Tile at (${tile.x}, ${tile.y}, layer ${tile.layer}) has negative elevation ${tile.elevation}.`,
      });
    }

    // Terrain resolves in the registry.
    if (!registry.has(tile.terrain)) {
      errors.push({
        code: 'unknown_terrain',
        message: `Tile at (${tile.x}, ${tile.y}, layer ${tile.layer}) has unregistered terrain '${tile.terrain}'.`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// Convenience: throws on validation failure. Use at load time when a
// silent fail isn't acceptable. The error message bundles every problem
// so the author sees them all at once instead of one-per-fix iteration.
export class MapValidationError_Throw extends Error {
  override readonly name = 'MapValidationError';
  constructor(readonly errors: ReadonlyArray<MapValidationError>) {
    super(
      `Map validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:\n` +
        errors.map((e) => `  [${e.code}] ${e.message}`).join('\n'),
    );
  }
}

export function assertMapValid(
  map: BattleMap,
  registry: TerrainRegistry,
): void {
  const result = validateMap(map, registry);
  if (!result.ok) {
    throw new MapValidationError_Throw(result.errors);
  }
}
