// Active hook handler collection.
//
// Walks the per-source contributions for a unit and returns the matching
// handlers ordered by source tier and per-handler priority. The returned
// handlers are *ctx-bound*: each `CollectedHandler.invoke` is a closure
// that has already captured its source-specific context, so runners
// dispatch uniformly with `invoke(args)` regardless of where the handler
// came from.
//
// Source kinds walked today:
// - Statuses (engine/status/) — session 3.
// - Equipped passive abilities (engine/abilities/) — session 5.
//
// Equipment and Class tiers will plug in here when their owning sessions
// land. Each new source adds a small per-source helper in this file
// (or its owning module) and `collectActiveHandlers` calls it.
//
// The source-of-truth is `unit.statuses`, `unit.loadout`, the catalog,
// and (eventually) `unit.equipment` + `unit.classState.currentClass`'s
// traits. No state is maintained beyond those; the (unitId, hookName)
// index is recomputed on read per ADR-0005.

import type { Catalog } from '../catalog/index.ts';
import { passiveContributionsFor } from '../abilities/contributions.ts';
import { statusContributionsFor } from '../status/contributions.ts';
import { getUnit, type GameState, type UnitId } from '../types/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type HookName,
  type HookSignatures,
  type HookSourceTier,
} from './hooks.ts';

// One collected handler ready to fire. Ctx-erased: the collector wraps
// the original handler in an `invoke` closure that has captured its
// source-specific context.
export interface CollectedHandler<K extends HookName> {
  readonly tier: HookSourceTier;
  readonly priority: number;
  // Stable index within the source's collection — for statuses, position
  // in `unit.statuses` (application order); for passives, position in the
  // bucket's ability list (equip order).
  readonly tieBreakIndex: number;
  readonly invoke: (args: HookSignatures[K]['args']) => HookSignatures[K]['return'];
}

interface ComparableForOrder {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
}

const TIER_ORDER: Readonly<Record<HookSourceTier, number>> = {
  equipment: 0,
  class: 1,
  passive: 2,
  status: 3,
};

function compareHandlers(a: ComparableForOrder, b: ComparableForOrder): number {
  if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.tieBreakIndex - b.tieBreakIndex;
}

// Per-source contributors return a (tier, ordered) list of handler
// records. The collector flattens them and sorts.
export interface SourceContribution<K extends HookName> {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
  readonly invoke: (args: HookSignatures[K]['args']) => HookSignatures[K]['return'];
}

export function collectActiveHandlers<K extends HookName>(
  state: GameState,
  unitId: UnitId,
  catalog: Catalog,
  hookName: K,
): ReadonlyArray<CollectedHandler<K>> {
  const unit = getUnit(state, unitId);
  const collected: CollectedHandler<K>[] = [];

  for (const c of statusContributionsFor(unit, catalog, hookName)) {
    collected.push(c);
  }
  for (const c of passiveContributionsFor(unit, catalog, hookName)) {
    collected.push(c);
  }

  collected.sort(compareHandlers);
  return collected;
}

// Re-exported so per-source helpers can build SourceContribution<K>
// records with consistent default priority handling.
export { DEFAULT_HOOK_PRIORITY };
