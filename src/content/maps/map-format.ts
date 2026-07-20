// The canonical battle-map spec — the shared substrate between the shipped
// generated map modules and the Cartographer editor (`?cartographer`).
//
// A map is authored as an ELEVATION GRID plus a small set of derivation
// data (S98, per the map-authoring brief; precedent ADR-0073's universal
// water-table rule):
//
//   - `bands` — the ordered elevation→terrain rules ("elevation bands →
//     terrain; the bands are content"). First match wins; no match falls
//     back to `ground`. The water table (0 → water_deep, 1 → water_shallow)
//     is the conventional first two entries; Mountain Pass's rock bands and
//     Alvera's elev-8 building walls are further entries.
//   - `terrainOverrides` — position-keyed terrain that beats the bands
//     (Stonebridge's nine hand-placed rampart tiles).
//   - `properties` — per-tile `TileProperty` tags (`bridge_ramp`,
//     `blocks_los`).
//   - `decks` — layer-1 stacked cells (Alvera's bridge deck; ADR-0155).
//
// Every shipped map decomposes into this shape losslessly (S98 audit,
// `docs/TABADesign/taba-map-authoring-findings.md`). `buildMapFromSpec` is
// the single builder the generated modules call; the Cartographer round-trip
// test pins that spec → module text → spec is byte-stable.

import type { BattleMap, TerrainType, Tile, TileProperty } from '@engine/index.ts';

// One elevation→terrain rule. `eq` matches the exact elevation; `gte`
// matches that elevation and everything above it. Evaluated in authored
// order — put `eq` specials ahead of broad `gte` bands.
export interface TerrainBand {
  readonly when: 'eq' | 'gte';
  readonly elevation: number;
  readonly terrain: TerrainType;
}

// Position-keyed terrain that wins over the bands.
export interface TerrainOverride {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
}

// Per-tile property tags on the ground (layer-0) tile at (x, y).
export interface TilePropertyTag {
  readonly x: number;
  readonly y: number;
  readonly properties: ReadonlyArray<TileProperty>;
}

// A layer-1 stacked cell (bridge deck). Elevation is absolute, like any
// tile; the map validator enforces BRIDGE_MIN_CLEARANCE over the ground
// tile beneath.
export interface DeckTile {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly terrain: TerrainType;
  readonly properties: ReadonlyArray<TileProperty>;
}

export interface MapSpec {
  // Registry key — 'alvera_village'. Also derives the generated module's
  // export identifiers (ALVERA_VILLAGE_WIDTH / alveraVillage).
  readonly key: string;
  // Display label — 'Alvera Village'.
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly bands: ReadonlyArray<TerrainBand>;
  // Row-major elevation grid: elevation[y][x], `height` rows of `width`.
  readonly elevation: ReadonlyArray<ReadonlyArray<number>>;
  readonly terrainOverrides: ReadonlyArray<TerrainOverride>;
  readonly properties: ReadonlyArray<TilePropertyTag>;
  readonly decks: ReadonlyArray<DeckTile>;
}

// The band rule: first matching band's terrain, else 'ground'.
export function terrainForElevation(
  bands: ReadonlyArray<TerrainBand>,
  elevation: number,
): TerrainType {
  for (const band of bands) {
    if (band.when === 'eq' ? elevation === band.elevation : elevation >= band.elevation) {
      return band.terrain;
    }
  }
  return 'ground';
}

// Build the runtime BattleMap: row-major layer-0 tiles (override ?? band
// terrain, tagged properties), then the decks in authored order — the same
// tile ordering the hand-written builders produced, so a migrated map is
// deep-equal to its predecessor. Throws loud on a malformed grid or an
// out-of-bounds override/tag/deck; a spec inconsistency is an authoring
// bug, not something to render around.
export function buildMapFromSpec(spec: MapSpec): BattleMap {
  if (spec.elevation.length !== spec.height) {
    throw new Error(
      `map spec '${spec.key}': elevation grid has ${spec.elevation.length} rows, expected ${spec.height}`,
    );
  }
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < spec.width && y >= 0 && y < spec.height;
  const overrideAt = new Map<string, TerrainType>();
  for (const o of spec.terrainOverrides) {
    if (!inBounds(o.x, o.y)) {
      throw new Error(`map spec '${spec.key}': terrain override (${o.x},${o.y}) out of bounds`);
    }
    overrideAt.set(`${o.x},${o.y}`, o.terrain);
  }
  const propertiesAt = new Map<string, ReadonlyArray<TileProperty>>();
  for (const p of spec.properties) {
    if (!inBounds(p.x, p.y)) {
      throw new Error(`map spec '${spec.key}': property tag (${p.x},${p.y}) out of bounds`);
    }
    propertiesAt.set(`${p.x},${p.y}`, p.properties);
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < spec.height; y++) {
    const row = spec.elevation[y]!;
    if (row.length !== spec.width) {
      throw new Error(
        `map spec '${spec.key}': elevation row y=${y} has ${row.length} columns, expected ${spec.width}`,
      );
    }
    for (let x = 0; x < spec.width; x++) {
      const elevation = row[x]!;
      tiles.push({
        x,
        y,
        layer: 0,
        elevation,
        terrain: overrideAt.get(`${x},${y}`) ?? terrainForElevation(spec.bands, elevation),
        properties: propertiesAt.get(`${x},${y}`) ?? [],
      });
    }
  }
  for (const d of spec.decks) {
    if (!inBounds(d.x, d.y)) {
      throw new Error(`map spec '${spec.key}': deck tile (${d.x},${d.y}) out of bounds`);
    }
    tiles.push({
      x: d.x,
      y: d.y,
      layer: 1,
      elevation: d.elevation,
      terrain: d.terrain,
      properties: d.properties,
    });
  }
  return { width: spec.width, height: spec.height, tiles };
}
