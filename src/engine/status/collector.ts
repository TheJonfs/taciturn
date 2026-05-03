// Active hook handler collection.
//
// Walks a unit's active statuses, looks up each one's type in the catalog,
// filters the type's hooks by name, and returns the matching handlers
// already sorted by source tier and per-handler priority. This is the
// "is the (unitId, hookName) index" referenced in
// docs/design/status-effects.md ("Registration") — built on read rather
// than maintained as state, since the source of truth is unit.statuses
// and the catalog. See ADR-0005's "Consequences" for why.
//
// Session 3 only collects from the Status tier. Equipment/Class/Passive
// collectors arrive in their owning sessions and merge into the same
// returned list, sorted by tier per HOOK_SOURCE_TIER_ORDER.

import type { Catalog } from '../catalog/index.ts';
import type { GameState, StatusInstance, UnitId } from '../types/index.ts';
import { getUnit } from '../types/index.ts';
import type {
  HookName,
  HookSignatures,
  HookSourceTier,
  StatusHookContext,
  StatusHookRegistration,
} from './hooks.ts';

// One collected handler ready to fire. The `K` parameter narrows the
// handler signature to its hook's contract; runners get type-safe access
// without casts at the call site.
export interface CollectedHandler<K extends HookName> {
  readonly tier: HookSourceTier;
  readonly priority: number;
  // Stable index within the source's collection — for statuses, the
  // status's position in `unit.statuses` (i.e., its application order).
  readonly tieBreakIndex: number;
  readonly handler: (
    args: HookSignatures[K]['args'],
    ctx: StatusHookContext,
  ) => HookSignatures[K]['return'];
  readonly context: StatusHookContext;
}

const DEFAULT_PRIORITY = 0;

// The comparison only reads ordering fields; structural typing makes
// this callable for any `CollectedHandler<K>` regardless of K.
interface ComparableForOrder {
  readonly tier: HookSourceTier;
  readonly priority: number;
  readonly tieBreakIndex: number;
}

function compareHandlers(a: ComparableForOrder, b: ComparableForOrder): number {
  // Tier order: equipment < class < passive < status. Lower tier first.
  const tierOrder: Readonly<Record<HookSourceTier, number>> = {
    equipment: 0,
    class: 1,
    passive: 2,
    status: 3,
  };
  if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.tieBreakIndex - b.tieBreakIndex;
}

// Build a CollectedHandler list for a single unit's active statuses for
// a given hook name. Type parameter K is the hook being queried; the
// returned handlers are typed to that hook's signature.
//
// The `as` casts are localized: the runtime guard `reg.name === hookName`
// is the discriminant, but TypeScript cannot prove that K-relative typing
// flows through array iteration on a discriminated union, so we assert
// the narrowed shape once and rely on the runtime guard for soundness.
export function collectActiveHandlers<K extends HookName>(
  state: GameState,
  unitId: UnitId,
  catalog: Catalog,
  hookName: K,
): ReadonlyArray<CollectedHandler<K>> {
  const unit = getUnit(state, unitId);
  const collected: CollectedHandler<K>[] = [];

  unit.statuses.forEach((instance: StatusInstance, index: number) => {
    const type = catalog.getStatusType(instance.typeId);
    for (const reg of type.hooks) {
      if (reg.name !== hookName) continue;
      const typedReg = reg as Extract<StatusHookRegistration, { name: K }>;
      collected.push({
        tier: 'status',
        priority: typedReg.priority ?? DEFAULT_PRIORITY,
        tieBreakIndex: index,
        handler: typedReg.handler as CollectedHandler<K>['handler'],
        context: { instance },
      });
    }
  });

  collected.sort(compareHandlers);
  return collected;
}
