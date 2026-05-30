// Worldcraft effect queue (Session 53, ADR-0088).
//
// Each Terraformer (or cross-class Worldcraft user) holds a bounded, ordered
// queue of the terrain effects it has cast. When a new cast would exceed the
// computed cap (`worldcraft_effect_cap`), the oldest entry is reverted before
// the new one is added — LIFO eviction. The queue lives per-unit on
// `Unit.worldcraftEffects`, parallel to `Unit.statuses`; array order is the
// eviction order (index 0 = oldest).
//
// Two effect kinds, each with its own revert:
//   - `terrain` — Pillar/Pit/Hill/Valley. Revert emits a
//     `system_terrain_change` swapping each change's new↔original elevation/
//     terrain. A revert that *drops* an occupied tile deals fall damage (the
//     terrain-change reducer handles it); a revert that *raises* does not.
//   - `barrier` — the Barrier ability. Carries a `ttl` (decremented on the
//     turn loop); revert/expiry emits a `system_barrier_change` clearing the
//     barrier tiles. No fall damage.

import type { AbilityId } from './ids.ts';
import type { TerrainTileChange } from './action.ts';

export interface TileCoord {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}

export interface WorldcraftTerrainEffect {
  readonly kind: 'terrain';
  readonly abilityId: AbilityId;
  // The exact change-set this cast applied — both original and new values
  // per tile, so the revert is a straight new↔original swap with no
  // re-derivation.
  readonly tileChanges: ReadonlyArray<TerrainTileChange>;
  // The tick this effect was cast (attribution / log ordering). Eviction
  // order is array position, not this value.
  readonly castTick: number;
}

export interface WorldcraftBarrierEffect {
  readonly kind: 'barrier';
  readonly abilityId: AbilityId;
  // The tiles this cast placed barriers on (cleared together on revert or
  // TTL expiry).
  readonly barrierTiles: ReadonlyArray<TileCoord>;
  readonly castTick: number;
  // Remaining rounds before the barrier vanishes regardless of HP. The queue
  // entry is the source of truth; the turn loop decrements it and the
  // tile-side `BarrierState.ttl` is kept in sync for rendering.
  readonly ttl: number;
}

export type WorldcraftEffectEntry = WorldcraftTerrainEffect | WorldcraftBarrierEffect;
