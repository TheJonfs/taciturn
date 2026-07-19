// Worldcraft cast resolution (Session 54, ADR-0088 substrate).
//
// Shared logic behind the five Worldcraft abilities (Pillar, Pit, Hill,
// Valley, Barrier). A Worldcraft cast is a geometric change, not an attack:
// it does not run the damage/status pipeline. Instead it
//   1. builds the tile-change set from the ability's `effects.worldcraft`
//      spec and the targeted tile(s),
//   2. produces the cast's `system_terrain_change` / `system_barrier_change`
//      ProposedAction,
//   3. records a matching effect-queue entry and runs
//      `enqueueWorldcraftEffect`, which LIFO-evicts the oldest entries (with
//      their revert actions) when the per-unit cap is exceeded.
//
// This module is pure and state-assembly-free: it returns the updated actor
// (queue mutated) plus the cast + revert ProposedActions. The caller (the
// `resolveWorldcraft` reducer) does the `withUnit` and appends the actions to
// `generatedActions` — per ADR-0088, terrain physically mutates (and fall
// damage fires) when the engine reduces those actions, not here.

import type { Catalog } from '../catalog/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/index.ts';
import { enqueueWorldcraftEffect } from '../effects/queue.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { tileAt, unitAt } from '../map/index.ts';
import type {
  AbilityTarget,
  BarrierState,
  GameState,
  ProposedAction,
  TerrainTileChange,
  TerrainType,
  Tile,
  TileCoord,
  Unit,
  UnitId,
  WorldcraftEffectEntry,
} from '../types/index.ts';

export interface WorldcraftCast {
  // The actor with the new effect-queue entry appended (and any evicted
  // entries removed). The caller does the `withUnit`.
  readonly actor: Unit;
  // The cast's own terrain/barrier change, plus the revert actions for any
  // entries the enqueue evicted (oldest first). Emit in this order.
  readonly actions: ReadonlyArray<ProposedAction>;
}

// Universal water-table convention (river-ridge.md "Elevation Grid",
// registered in the default ruleset): elev 0 → deep water, 1 → shallow
// water, ≥ 2 → land. A Worldcraft change moves elevation and terrain in
// lockstep. Crossing the water boundary flips the terrain string; staying
// within the land band preserves the tile's existing land terrain identity
// (so a raised `rampart` is still `rampart`, not flattened to `ground`).
function terrainForElevation(
  originalTerrain: TerrainType,
  originalElevation: number,
  newElevation: number,
): TerrainType {
  if (newElevation <= 0) return 'water_deep';
  if (newElevation === 1) return 'water_shallow';
  // Land band: a tile surfacing from water becomes ground; an already-land
  // tile keeps its terrain type.
  if (originalElevation <= 1) return 'ground';
  return originalTerrain;
}

// Build the per-tile effects of an `elevation` Worldcraft cast
// (Pillar/Pit single tile; Hill/Valley 3×3 kernel) anchored at `anchor`.
// Offsets that fall outside the map are skipped. Elevation is floored at 0
// (deep-water floor) — a Pit on a low tile can't dig below the water table.
// A no-change tile (newElevation === current, e.g. a net-lowering cast on the
// water floor) is filtered out, so this can return an empty set. Exported so
// `validateAction` can reject a cast that would change nothing without
// re-deriving the kernel geometry (single source of truth, S55).
//
// S96 (bridges, ADR-0155): a kernel cell landing on a DECK tile (layer ≥ 1)
// is not earth — it cannot be reshaped, only smashed:
//   - a LOWERING delta destroys the deck (collected in `destroyTiles`; the
//     caller emits a permanent, non-queued `system_bridge_destroy`);
//   - a RAISING delta is skipped (there is no earth up there to pile; the
//     single-tile Pillar case gets a specific validation rejection).
export interface ElevationCast {
  readonly tileChanges: TerrainTileChange[];
  readonly destroyTiles: Array<{ readonly x: number; readonly y: number; readonly layer: number }>;
}

export function buildElevationCast(
  state: GameState,
  anchor: { readonly x: number; readonly y: number; readonly layer: number },
  deltas: ReadonlyArray<{ readonly dx: number; readonly dy: number; readonly delta: number }>,
): ElevationCast {
  const changes: TerrainTileChange[] = [];
  const destroyTiles: ElevationCast['destroyTiles'] = [];
  for (const d of deltas) {
    const x = anchor.x + d.dx;
    const y = anchor.y + d.dy;
    // Kernel offsets can fall off the map edge (a Hill cast near a corner);
    // skip those tiles. `tileAt` throws on out-of-bounds, so guard first.
    if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
    const tile = tileAt(state.map, x, y, anchor.layer);
    if (tile === undefined) continue;
    if (tile.layer >= 1) {
      if (d.delta < 0) destroyTiles.push({ x, y, layer: tile.layer });
      continue;
    }
    const newElevation = Math.max(0, tile.elevation + d.delta);
    if (newElevation === tile.elevation) continue;
    changes.push({
      x,
      y,
      layer: anchor.layer,
      originalElevation: tile.elevation,
      newElevation,
      originalTerrain: tile.terrain,
      newTerrain: terrainForElevation(tile.terrain, tile.elevation, newElevation),
    });
  }
  return { tileChanges: changes, destroyTiles };
}

// The landing tile for a unit dropped by a collapsing deck at (x, y): the
// layer-0 tile there, or — when occupied — the first free cardinal-neighbor
// layer-0 tile (N/E/S/W order, deterministic). Null when nowhere exists
// (`validateAction` rejects the cast in that pathological case; the reducer
// fails loud if it is somehow reached). Shared by validation and the
// `system_bridge_destroy` reducer so offer and gate can't drift.
export function bridgeFallLanding(
  state: GameState,
  x: number,
  y: number,
  // The unit being dropped — its own pre-fall position must not count as
  // an occupied blocker (it vacates the deck as it falls).
  fallerId?: UnitId,
): Tile | null {
  const free = (tx: number, ty: number): Tile | null => {
    const t = tileAt(state.map, tx, ty, 0);
    if (t === undefined) return null;
    const occupant = unitAt(state, tx, ty, 0);
    if (occupant !== undefined && occupant.id !== fallerId) return null;
    return t;
  };
  const below = free(x, y);
  if (below !== null) return below;
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.map.width || ny >= state.map.height) continue;
    const t = free(nx, ny);
    if (t !== null) return t;
  }
  return null;
}

// Barrier HP = caster PA × MA (per blueprint). Both stats are read computed
// (not stored) so equipment / status modifiers compose — notably Battle
// Dictionary's +1 PA, the first place the Terraformer's PA pays off.
function barrierHp(state: GameState, catalog: Catalog, actor: Unit): number {
  const pa = runModifyStatQuery(state, catalog, {
    unit: actor,
    statName: 'pa',
    baseValue: actor.baseStats.pa,
  });
  const ma = runModifyStatQuery(state, catalog, {
    unit: actor,
    statName: 'ma',
    baseValue: actor.baseStats.ma,
  });
  return Math.max(1, pa * ma);
}

// Resolve a Worldcraft cast: build the cast action + effect-queue entry,
// enqueue it (evicting the oldest with revert actions if over cap), and
// return the updated actor + the action chain to emit.
export function resolveWorldcraftCast(
  state: GameState,
  catalog: Catalog,
  ability: ActiveAbilityDefinition,
  actor: Unit,
  target: AbilityTarget,
): WorldcraftCast {
  const spec = ability.effects.worldcraft;
  if (spec === undefined) {
    throw new Error(
      `resolveWorldcraftCast: ability ${JSON.stringify(ability.id)} has no worldcraft effect spec`,
    );
  }

  let castAction: ProposedAction;
  let entry: WorldcraftEffectEntry;

  if (spec.kind === 'elevation') {
    if (target.kind !== 'tile') {
      throw new Error(
        `resolveWorldcraftCast: elevation ability ${JSON.stringify(ability.id)} requires a tile target`,
      );
    }
    const anchor = target.position;
    const { tileChanges, destroyTiles } = buildElevationCast(state, anchor, spec.deltas);
    // S96 (bridges): deck cells in the kernel are destroyed PERMANENTLY —
    // the destroy action rides beside the terrain change but never enters
    // the effect queue (the queue is the home of revertible effects; the
    // earth remembers, carpentry doesn't). A destroy-only cast (Pit on a
    // deck) consumes no queue slot at all.
    const destroyAction: ProposedAction | null =
      destroyTiles.length > 0
        ? { type: 'system_bridge_destroy', source: 'system', payload: { tiles: destroyTiles } }
        : null;
    if (tileChanges.length === 0) {
      return {
        actor,
        actions: destroyAction !== null ? [destroyAction] : [],
      };
    }
    castAction = {
      type: 'system_terrain_change',
      source: 'system',
      payload: { tileChanges },
    };
    entry = {
      kind: 'terrain',
      abilityId: ability.id,
      tileChanges,
      castTick: state.tick,
    };
    const enqueuedElevation = enqueueWorldcraftEffect(state, catalog, actor, entry);
    return {
      actor: enqueuedElevation.unit,
      actions: [
        castAction,
        ...(destroyAction !== null ? [destroyAction] : []),
        ...enqueuedElevation.revertActions,
      ],
    };
  } else {
    // barrier
    if (target.kind !== 'tile_set') {
      throw new Error(
        `resolveWorldcraftCast: barrier ability ${JSON.stringify(ability.id)} requires a tile_set target`,
      );
    }
    const hp = barrierHp(state, catalog, actor);
    const barrier: BarrierState = { hp, ttl: spec.ttl, ownerId: actor.id };
    const barrierTiles: TileCoord[] = target.positions.map((p) => ({
      x: p.x,
      y: p.y,
      layer: p.layer,
    }));
    castAction = {
      type: 'system_barrier_change',
      source: 'system',
      payload: {
        tileChanges: barrierTiles.map((t) => ({ x: t.x, y: t.y, layer: t.layer, barrier })),
      },
    };
    entry = {
      kind: 'barrier',
      abilityId: ability.id,
      barrierTiles,
      castTick: state.tick,
      ttl: spec.ttl,
    };
  }

  const enqueued = enqueueWorldcraftEffect(state, catalog, actor, entry);
  return {
    actor: enqueued.unit,
    actions: [castAction, ...enqueued.revertActions],
  };
}
