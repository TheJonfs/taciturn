// Test-only fixtures for map subsystem tests.
// Does not match Vitest's pattern, so it's not picked up as a test file.
//
// `flatMap(width, height)` builds a single-layer ground map at elevation 0
// — the workhorse for pathfinding / range / AoE tests that don't care
// about height variation.
//
// `mapFrom(grid)` accepts an ASCII-style spec for richer maps:
//   const map = mapFrom([
//     'GGGG',
//     'GWWG',
//     'GGGG',
//   ]);
// Each char is a tile at layer 0; mapping defaults to 'G'=ground el 0,
// 'W'=water el 0, '.'=no tile (gap). Callers can override the legend.
//
// `tileSpec` and `mapWith` are the lower-level builders for tests that
// need multi-layer or property-tagged tiles.

import type {
  BarrierState,
  BattleMap,
  TeamId,
  TerrainType,
  Tile,
  TileProperty,
} from '../types/index.ts';

export interface TileSpec {
  readonly x: number;
  readonly y: number;
  readonly layer?: number;
  readonly elevation?: number;
  readonly terrain?: TerrainType;
  readonly properties?: ReadonlyArray<TileProperty>;
  // Optional deployment-zone tag. Pass `undefined` (or omit) for a
  // non-zone tile; pass a TeamId for a team-tagged zone; `null` is the
  // "shared zone" sentinel reserved for future content. Mirrors the
  // `Tile.deploymentZone` field.
  readonly deploymentZone?: TeamId | null;
  // Session 53: optional Barrier object on the tile, for barrier substrate
  // tests. Omit for a normal tile.
  readonly barrier?: BarrierState;
}

export function tileFrom(spec: TileSpec): Tile {
  return {
    x: spec.x,
    y: spec.y,
    layer: spec.layer ?? 0,
    elevation: spec.elevation ?? 0,
    terrain: spec.terrain ?? 'ground',
    properties: spec.properties ?? [],
    ...(spec.deploymentZone !== undefined ? { deploymentZone: spec.deploymentZone } : {}),
    ...(spec.barrier !== undefined ? { barrier: spec.barrier } : {}),
  };
}

export function mapWith(args: {
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<TileSpec>;
}): BattleMap {
  return {
    width: args.width,
    height: args.height,
    tiles: args.tiles.map(tileFrom),
  };
}

// A flat width×height map of ground tiles at layer 0, elevation 0.
export function flatMap(width: number, height: number): BattleMap {
  const tiles: TileSpec[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y });
    }
  }
  return mapWith({ width, height, tiles });
}

export interface AsciiLegendEntry {
  readonly terrain?: TerrainType;
  readonly elevation?: number;
  readonly properties?: ReadonlyArray<TileProperty>;
  readonly skip?: boolean; // no tile at this (x, y)
}

const DEFAULT_LEGEND: Record<string, AsciiLegendEntry> = {
  G: { terrain: 'ground' },
  W: { terrain: 'water' },
  S: { terrain: 'sand' },
  '.': { skip: true },
};

// Build a single-layer map from row-major ASCII rows. Row index = y;
// column index = x. Caller-supplied legend entries override defaults.
export function mapFrom(
  rows: ReadonlyArray<string>,
  overrides: Readonly<Record<string, AsciiLegendEntry>> = {},
): BattleMap {
  if (rows.length === 0) return mapWith({ width: 0, height: 0, tiles: [] });
  const height = rows.length;
  const width = rows[0]!.length;
  const legend: Record<string, AsciiLegendEntry> = { ...DEFAULT_LEGEND, ...overrides };
  const tiles: TileSpec[] = [];
  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    if (row.length !== width) {
      throw new Error(`mapFrom: row ${y} has length ${row.length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const entry = legend[ch];
      if (entry === undefined) {
        throw new Error(`mapFrom: no legend entry for character ${JSON.stringify(ch)}`);
      }
      if (entry.skip) continue;
      tiles.push({
        x,
        y,
        terrain: entry.terrain ?? 'ground',
        elevation: entry.elevation ?? 0,
        properties: entry.properties ?? [],
      });
    }
  }
  return mapWith({ width, height, tiles });
}
