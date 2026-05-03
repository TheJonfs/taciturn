// Passive-tier contribution to the active-handler collector.
//
// Walks a unit's equipped passive abilities (across every passive bucket
// in `unit.loadout.passiveBuckets`), looks each one up in the catalog,
// filters its hooks by name, and yields one `SourceContribution<K>` per
// matching handler. The collector flattens these alongside contributions
// from other source kinds (statuses, equipment, class) into the final
// ordered handler list.
//
// `tieBreakIndex` orders handlers within the Passive tier: bucket
// iteration order (the BUCKET_IDS constant) outer, then ability index
// inside each bucket. Per ADR-0005 / status-effects.md, the within-tier
// order is "deterministic by source enumeration order"; for passives
// that's bucket order then equip order.

import type { Catalog } from '../catalog/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type SourceContribution,
} from '../hooks/collector.ts';
import type { HookName, HookSignatures } from '../hooks/hooks.ts';
import type { AbilityId, Unit } from '../types/index.ts';
import { PASSIVE_BUCKET_IDS } from './constants.ts';
import type { PassiveHookRegistration } from './hooks.ts';

export function* passiveContributionsFor<K extends HookName>(
  unit: Unit,
  catalog: Catalog,
  hookName: K,
): Generator<SourceContribution<K>> {
  let tieBreakIndex = 0;
  for (const bucketId of PASSIVE_BUCKET_IDS) {
    const equipped: ReadonlyArray<AbilityId> =
      unit.loadout.passiveBuckets[bucketId] ?? [];
    for (const abilityId of equipped) {
      const ability = catalog.getAbility(abilityId);
      if (ability.kind !== 'passive') continue;
      for (const reg of ability.hooks) {
        if (reg.name !== hookName) continue;
        const typedReg = reg as Extract<PassiveHookRegistration, { name: K }>;
        // Cast through the K-relative handler signature: the runtime
        // guard above narrows the union, but TS can't carry K through
        // the discriminated extract on a generic. Same pattern as in
        // the status contributor; ADR-0005 covers the rationale.
        const handler = typedReg.handler as (
          args: HookSignatures[K]['args'],
          ctx: { ability: typeof ability },
        ) => HookSignatures[K]['return'];
        const localIndex = tieBreakIndex++;
        yield {
          tier: 'passive',
          priority: typedReg.priority ?? DEFAULT_HOOK_PRIORITY,
          tieBreakIndex: localIndex,
          invoke: (args: HookSignatures[K]['args']) => handler(args, { ability }),
        };
      }
    }
  }
}
