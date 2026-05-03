// Tiles and the Map container.
// See docs/design/core-types.md ("Tile and Map") and
// docs/design/map-and-battlefield.md.
//
// Accessor functions (tilesAt, tileAt, unitAt) land in session 4 alongside
// the rest of the map subsystem; ADR-0002 fixes their return-type pattern.

// Open string unions; populated as map content is authored. Authors may add
// new terrain or property names without an engine change.
export type TerrainType = string;
export type TileProperty = string;

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly elevation: number;
  readonly terrain: TerrainType;
  readonly properties: ReadonlyArray<TileProperty>;
}

export interface BattleMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<Tile>;
}
