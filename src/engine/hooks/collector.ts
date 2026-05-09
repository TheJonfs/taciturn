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
import { equipmentContributionsFor } from '../items/contributions.ts';
import { statusContributionsFor } from '../status/contributions.ts';
import { getUnit, type GameState, type StatusTypeId, type UnitId } from '../types/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type HookName,
  type HookSignatures,
  type HookSourceTier,
} from './hooks.ts';

// One collected handler ready to fire. Ctx-erased: the collector wraps
// the original handler in an `invoke` closure that has captured its
// source-specific context.
//
// `sourceTypeId` is set when the handler came from a status; it's the
// id of the StatusEffectType that registered the handler. Used by
// runOnTick to filter to the ticking status's own handlers (other
// statuses on the unit may have onTick handlers that fire on *their*
// tick, not this one). Passive / equipment / class sources leave it
// undefined.
export interface CollectedHandler<K extends HookName> {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
  readonly sourceTypeId?: StatusTypeId;
  readonly invoke: (args: HookSignatures[K]['args']) => HookSignatures[K]['return'];
}

interface ComparableForOrder {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
}

// Build a tier-rank map from the active ruleset's source-tier ordering.
// The ruleset is read once per `collectActiveHandlers` call; the map is
// closed over by the comparator. A tier missing from the ruleset's list
// is ranked after every named tier (defensive — should not happen with
// a well-formed ruleset, but a missing entry should not silently mean
// "tier 0").
function buildTierRank(
  sourceTiers: ReadonlyArray<HookSourceTier>,
): Readonly<Record<HookSourceTier, number>> {
  const rank: Partial<Record<HookSourceTier, number>> = {};
  for (let i = 0; i < sourceTiers.length; i++) {
    rank[sourceTiers[i]!] = i;
  }
  const fallback = sourceTiers.length;
  return {
    equipment: rank.equipment ?? fallback,
    class: rank.class ?? fallback,
    passive: rank.passive ?? fallback,
    status: rank.status ?? fallback,
  };
}

function makeCompareHandlers(tierRank: Readonly<Record<HookSourceTier, number>>) {
  return function compareHandlers(a: ComparableForOrder, b: ComparableForOrder): number {
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.tieBreakIndex - b.tieBreakIndex;
  };
}

// Per-source contributors return a (tier, ordered) list of handler
// records. The collector flattens them and sorts.
export interface SourceContribution<K extends HookName> {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
  readonly sourceTypeId?: StatusTypeId;
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
  for (const c of equipmentContributionsFor(unit, catalog, hookName)) {
    collected.push(c);
  }

  const ruleset = catalog.getRuleset(state.ruleset.id);
  const tierRank = buildTierRank(ruleset.hookOrdering.sourceTiers);
  collected.sort(makeCompareHandlers(tierRank));
  return collected;
}

// Re-exported so per-source helpers can build SourceContribution<K>
// records with consistent default priority handling.
export { DEFAULT_HOOK_PRIORITY };
