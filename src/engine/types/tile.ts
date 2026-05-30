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

import type { TeamId, UnitId } from './ids.ts';

// Session 53 (ADR-0088): a destructible Barrier object occupying a tile.
// Spawned by the Terraformer's Worldcraft Barrier ability (S54); modeled as
// a tile-side field rather than a parallel unit-like collection so the
// existing pathfinding `canEnter` / line-of-sight gates handle impassability
// and sight-blocking without widening the `Unit`-typed damage pipeline.
//
//   - `hp` — current hit points. Reduced by `system_barrier_damage` (a
//     pipeline-bypassing system action). At ≤ 0 the barrier is destroyed
//     (the field is cleared).
//   - `ttl` — remaining rounds before the barrier vanishes regardless of
//     HP. Decremented on the turn loop alongside status durations; at 0 the
//     barrier is cleared. Mirrored on the owner's effect-queue entry, which
//     is the source of truth the turn loop reads.
//   - `ownerId` — the Terraformer that cast it (attribution; whose queue
//     holds the matching effect entry).
export interface BarrierState {
  readonly hp: number;
  readonly ttl: number;
  readonly ownerId: UnitId;
}

export interface Tile {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly elevation: number;
  readonly terrain: TerrainType;
  readonly properties: ReadonlyArray<TileProperty>;
  // Session 53: a Barrier object on this tile, if any. Present → the tile is
  // impassable and blocks line-of-sight; absent (the common case) → normal
  // tile. Set/cleared via `system_barrier_change`; HP-damaged via
  // `system_barrier_damage`.
  readonly barrier?: BarrierState;
  // Per ADR-0049 / session 25: which team (if any) may deploy onto this
  // tile during the pre-battle deployment phase. `undefined` = not a
  // deployment-zone tile; `null` = explicitly neutral (reserved for
  // future "shared zone" maps). Map authors set this for tiles that
  // gate the team-builder's deployment placement; no engine code today
  // consumes it (deployment-phase UI lands in a later session).
  readonly deploymentZone?: TeamId | null;
}

export interface BattleMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<Tile>;
}
