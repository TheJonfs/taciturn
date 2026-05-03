// Status-tier contribution to the active-handler collector.
//
// Walks a unit's `statuses`, looks each one up in the catalog, filters
// the type's hooks by name, and yields one `SourceContribution<K>` per
// matching handler. The collector flattens these alongside contributions
// from other source kinds (passives, equipment, class) into the final
// ordered handler list.

import type { Catalog } from '../catalog/index.ts';
import type { Unit } from '../types/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type SourceContribution,
} from '../hooks/collector.ts';
import type { HookName, HookSignatures } from '../hooks/hooks.ts';
import type { StatusHookRegistration } from './hooks.ts';

export function* statusContributionsFor<K extends HookName>(
  unit: Unit,
  catalog: Catalog,
  hookName: K,
): Generator<SourceContribution<K>> {
  for (let i = 0; i < unit.statuses.length; i++) {
    const instance = unit.statuses[i]!;
    const type = catalog.getStatusType(instance.typeId);
    for (const reg of type.hooks) {
      if (reg.name !== hookName) continue;
      // The runtime guard `reg.name === hookName` narrows the discriminated
      // union; TS can't carry K-relative typing through the array iteration.
      // Cast through the K-relative handler signature — same pattern as
      // the passive contributor; ADR-0005 covers the rationale.
      const typedReg = reg as Extract<StatusHookRegistration, { name: K }>;
      const handler = typedReg.handler as (
        args: HookSignatures[K]['args'],
        ctx: { instance: typeof instance },
      ) => HookSignatures[K]['return'];
      yield {
        tier: 'status',
        priority: typedReg.priority ?? DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: i,
        invoke: (args: HookSignatures[K]['args']) => handler(args, { instance }),
      };
    }
  }
}
