// Equipment-tier contribution to the active-handler collector.
//
// Walks a unit's five equipment slots (left/right hand, headgear,
// armor, accessory), looks each non-null item up in the catalog, and
// yields one `SourceContribution<K>` per stat-mod entry that matches
// the queried hook. v1's only equipment-driven hook is `modifyStatQuery`
// — items declare additive `statMods` (PA / MA / maxHpBase / etc.) and
// the contributor emits one handler per stat per item.
//
// Status grants (`statusGrants`) are not handled here. They become
// ordinary StatusInstances (with `source.kind === 'equipment'`) at
// `createInitialState`; the status-source contributor walks them
// alongside other statuses.
//
// `tieBreakIndex` orders handlers within the Equipment tier: slot
// iteration order outer, then a small per-stat counter inside each
// item's statMods iteration. Same "deterministic by source enumeration
// order" rule as the passive / status contributors.

import type { Catalog } from '../catalog/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type SourceContribution,
} from '../hooks/collector.ts';
import type { HookName, HookSignatures } from '../hooks/hooks.ts';
import type {
  PartialBaseStats,
  StatName,
  Unit,
} from '../types/index.ts';
import { iterateEquippedItems } from './equipment.ts';

// Map the BaseStats field names we surface as `modifyStatQuery` to the
// stat names the runner queries. The two are identical for the v1 set;
// the indirection is here so a future stat with a different storage
// vs. query key (e.g., `maxHpBase` → `maxHp`) can be added in one place.
const STAT_MOD_KEYS: ReadonlyArray<{ readonly statKey: keyof PartialBaseStats; readonly statName: StatName }> = [
  { statKey: 'spd', statName: 'spd' },
  { statKey: 'pa', statName: 'pa' },
  { statKey: 'ma', statName: 'ma' },
  { statKey: 'maxHpBase', statName: 'maxHp' },
  { statKey: 'brave', statName: 'brave' },
  { statKey: 'faith', statName: 'faith' },
];

export function* equipmentContributionsFor<K extends HookName>(
  unit: Unit,
  catalog: Catalog,
  hookName: K,
): Generator<SourceContribution<K>> {
  // v1: only modifyStatQuery is equipment-driven. Other hooks ship
  // their own equipment branches as content surfaces them.
  if (hookName !== 'modifyStatQuery') return;

  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.statMods === undefined) continue;
    for (const { statKey, statName } of STAT_MOD_KEYS) {
      const delta = item.statMods[statKey];
      if (delta === undefined || delta === 0) continue;
      const localIndex = tieBreakIndex++;
      const localStatName = statName;
      const localDelta = delta;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        // Cast: the contributor only fires for `modifyStatQuery` per
        // the runtime guard above, but the K parameter keeps the
        // contributor source-agnostic. The handler's args/return
        // shape match modifyStatQuery's signature exactly.
        invoke: ((args: HookSignatures['modifyStatQuery']['args']) => {
          if (args.statName !== localStatName) return args.baseValue;
          return args.baseValue + localDelta;
        }) as (args: HookSignatures[K]['args']) => HookSignatures[K]['return'],
      };
    }
  }
}
