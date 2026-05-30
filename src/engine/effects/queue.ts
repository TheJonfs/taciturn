// Worldcraft effect-queue helper (Session 53, ADR-0088).
//
// A unit's `worldcraftEffects` is a bounded, ordered LIFO queue (index 0 =
// oldest). When a Worldcraft cast would push the queue past its computed cap
// (`worldcraft_effect_cap`, default 2; Expert Former Support adds +2), the
// oldest entries are *reverted* before the new one is appended:
//   - a `terrain` entry reverts via a `system_terrain_change` that swaps each
//     change's new↔original elevation/terrain (a revert that drops an
//     occupied tile deals fall damage — handled by the terrain-change
//     reducer; a revert that raises does not);
//   - a `barrier` entry reverts via a `system_barrier_change` clearing its
//     barrier tiles.
//
// `enqueueWorldcraftEffect` is pure: it returns the updated unit plus the
// revert ProposedActions the caller should emit onto the action chain. The
// caller (a Worldcraft ability reducer, S54) does the `withUnit` and appends
// the reverts to `generatedActions`; the engine reduces them — which is when
// the terrain physically reverts and any fall damage fires.
//
// The cap is read computed-not-stored (CLAUDE rule 5): every enqueue re-asks
// `runModifyStatQuery`, so equipping/unequipping Expert Former changes the
// cap dynamically.

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import type {
  GameState,
  ProposedAction,
  Unit,
  WorldcraftEffectEntry,
} from '../types/index.ts';

export const DEFAULT_WORLDCRAFT_EFFECT_CAP = 2;

// The unit's current Worldcraft effect cap. Base 2; modifyStatQuery handlers
// (Expert Former) adjust it.
export function computeWorldcraftEffectCap(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
): number {
  return runModifyStatQuery(state, catalog, {
    unit,
    statName: 'worldcraft_effect_cap',
    baseValue: DEFAULT_WORLDCRAFT_EFFECT_CAP,
  });
}

// The ProposedAction(s) that undo one queued effect.
export function revertActionsFor(entry: WorldcraftEffectEntry): ReadonlyArray<ProposedAction> {
  if (entry.kind === 'terrain') {
    const tileChanges = entry.tileChanges.map((c) => ({
      x: c.x,
      y: c.y,
      layer: c.layer,
      // Swap: the revert's "new" is the effect's "original" and vice versa.
      originalElevation: c.newElevation,
      newElevation: c.originalElevation,
      originalTerrain: c.newTerrain,
      newTerrain: c.originalTerrain,
    }));
    return [{ type: 'system_terrain_change', source: 'system', payload: { tileChanges } }];
  }
  // barrier — clear every tile this cast placed a barrier on.
  const tileChanges = entry.barrierTiles.map((t) => ({
    x: t.x,
    y: t.y,
    layer: t.layer,
    barrier: null,
  }));
  return [{ type: 'system_barrier_change', source: 'system', payload: { tileChanges } }];
}

export interface EnqueueResult {
  // The unit with the new entry appended and any evicted entries removed.
  readonly unit: Unit;
  // Revert actions for the evicted entries, in eviction order (oldest first).
  // Emit these onto the action chain.
  readonly revertActions: ReadonlyArray<ProposedAction>;
}

// Append `entry` to `unit`'s queue, LIFO-evicting (and reverting) the oldest
// entries first if the cap would be exceeded. Serial eviction (per D7): each
// evicted entry produces its own revert action, so fall damage is computed
// tile-by-tile against the intermediate map state when the chain reduces.
export function enqueueWorldcraftEffect(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
  entry: WorldcraftEffectEntry,
): EnqueueResult {
  const cap = computeWorldcraftEffectCap(state, catalog, unit);
  const queue = [...unit.worldcraftEffects];
  const revertActions: ProposedAction[] = [];
  // Evict from the front (oldest) until appending `entry` fits within `cap`.
  // The `queue.length > 0` guard prevents an infinite loop on a pathological
  // cap ≤ 0 (which shouldn't occur — base 2, additive bonuses).
  while (queue.length > 0 && queue.length + 1 > cap) {
    const evicted = queue.shift()!;
    revertActions.push(...revertActionsFor(evicted));
  }
  queue.push(entry);
  return { unit: { ...unit, worldcraftEffects: queue }, revertActions };
}

export interface BarrierTickResult {
  readonly unit: Unit;
  // `system_barrier_change` clears for any barrier whose TTL hit 0.
  readonly clearActions: ReadonlyArray<ProposedAction>;
}

// Decrement the TTL of this unit's `barrier` effects by one (piggybacks the
// turn-loop status-duration decrement — called from `reduceTurnStart`). A
// barrier whose TTL reaches 0 is removed from the queue and its tiles cleared
// via an emitted `system_barrier_change`. `terrain` effects have no TTL and
// are untouched (they persist until cap eviction).
//
// Returns the *same* unit reference untouched when the unit holds no barrier
// effects — the overwhelmingly common case — so the turn-loop wiring is a
// genuine no-op for every non-Terraformer.
export function decrementBarrierTtls(unit: Unit): BarrierTickResult {
  if (!unit.worldcraftEffects.some((e) => e.kind === 'barrier')) {
    return { unit, clearActions: [] };
  }
  const kept: WorldcraftEffectEntry[] = [];
  const clearActions: ProposedAction[] = [];
  for (const e of unit.worldcraftEffects) {
    if (e.kind !== 'barrier') {
      kept.push(e);
      continue;
    }
    const ttl = e.ttl - 1;
    if (ttl <= 0) {
      clearActions.push(...revertActionsFor(e));
    } else {
      kept.push({ ...e, ttl });
    }
  }
  return { unit: { ...unit, worldcraftEffects: kept }, clearActions };
}
