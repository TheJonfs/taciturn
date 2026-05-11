// Equipment-tier contribution to the active-handler collector.
//
// Walks a unit's equipment slots, looks each non-null item up in the
// catalog, and yields one `SourceContribution<K>` per equipment-driven
// effect that matches the queried hook. Per-hook contributors are
// registered in `EQUIPMENT_CONTRIBUTORS` below — adding equipment
// integration for a new hook is a single entry in the map plus a
// contributor function. Per ADR-0056 (Session 27).
//
// Status grants (`statusGrants`) are not handled here. They become
// ordinary StatusInstances (with `source.kind === 'equipment'`) at
// `createInitialState`; the status-source contributor walks them
// alongside other statuses.
//
// Per-hook contributors live in this file (one function each) so the
// registry stays inspectable in one place. The map's per-hook value is
// typed against `EquipmentContributor<K>` so a contributor returning
// the wrong-shape `SourceContribution` is a compile error.
//
// `tieBreakIndex` orders handlers within the Equipment tier: each
// contributor maintains its own per-call counter (slot iteration order
// outer, per-item entry inner). Same "deterministic by source
// enumeration order" rule as the passive / status contributors.

import type { Catalog } from '../catalog/index.ts';
import {
  DEFAULT_HOOK_PRIORITY,
  type SourceContribution,
} from '../hooks/collector.ts';
import type { HookName } from '../hooks/hooks.ts';
import type {
  DamageTag,
  PartialBaseStats,
  StatName,
  Unit,
} from '../types/index.ts';
import { iterateEquippedItems } from './equipment.ts';

// Per-hook contributor signature. Each one walks a unit's equipped
// items, inspects whatever fields on `ItemDefinition` are relevant to
// its hook, and yields one `SourceContribution<K>` per declared effect.
type EquipmentContributor<K extends HookName> = (
  unit: Unit,
  catalog: Catalog,
) => Generator<SourceContribution<K>>;

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

// modifyStatQuery contributor: each item's `statMods` declares additive
// deltas on the BaseStats subset. One handler per non-zero stat per
// item. The handler gates on `args.statName` so a unit reading 'pa'
// only sees the +PA contributions, not the +MA ones.
function* statQueryContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyStatQuery'>> {
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
        invoke: (args) => {
          if (args.statName !== localStatName) return args.baseValue;
          return args.baseValue + localDelta;
        },
      };
    }
  }
}

// modifyMpCost contributor: each item's `mpCostMultipliers` declares
// multiplicative factors (Staff of Power × 1.20). One handler per
// factor per item. Composition is multiplicative — the chain product
// flows through `computeMpCost`'s round-half-up at the exit.
function* mpCostContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyMpCost'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.mpCostMultipliers === undefined) continue;
    for (const factor of item.mpCostMultipliers) {
      const localIndex = tieBreakIndex++;
      const localFactor = factor;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => args.baseCost * localFactor,
      };
    }
  }
}

// modifyActionSpeed contributor: each item's `actionSpeedModifiers`
// declares additive deltas, optionally gated on the ability's damage
// tags. Tag-conditional handlers (Wand of Deepwood: +5 only on Earth-
// tagged casts) inspect `args.ability.effects.damage?.tags` to decide
// whether to apply.
function* actionSpeedContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyActionSpeed'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.actionSpeedModifiers === undefined) continue;
    for (const mod of item.actionSpeedModifiers) {
      const localIndex = tieBreakIndex++;
      const localDelta = mod.delta;
      const localFilter = mod.tagFilter;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localFilter !== undefined) {
            const abilityTags = args.ability.effects.damage?.tags;
            if (abilityTags === undefined) return args.baseActionSpeed;
            const matches = localFilter.some((t: DamageTag) => abilityTags.includes(t));
            if (!matches) return args.baseActionSpeed;
          }
          return args.baseActionSpeed + localDelta;
        },
      };
    }
  }
}

// modifyResistance contributor: each item's `resistanceMods` declares
// per-tag additive shifts (Capacitor Ring +50 Lightning, Wand of
// Depths {lightning: +50, fire: -50}). One handler per (tag, delta)
// entry per item. The handler gates on `args.tag` so a Wand of Depths
// reading 'lightning' returns base + 50 and reading 'fire' returns
// base - 50.
function* resistanceContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyResistance'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.resistanceMods === undefined) continue;
    for (const [tag, delta] of item.resistanceMods) {
      if (delta === 0) continue;
      const localIndex = tieBreakIndex++;
      const localTag = tag;
      const localDelta = delta;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (args.tag !== localTag) return args.baseValue;
          return args.baseValue + localDelta;
        },
      };
    }
  }
}

// modifyIncomingStatusApplicationChance contributor: each item's
// `incomingStatusModifiers` declares per-type or per-tag multiplicative
// gates (Pointy Hat: Silence × 0.5; Focus Band: any negative-tagged
// status × 0.75). One handler per entry. Handlers gate on
// `args.statusType.id` (by_type) or `args.statusType.tags` (by_tag).
function* incomingStatusChanceContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyIncomingStatusApplicationChance'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.incomingStatusModifiers === undefined) continue;
    for (const mod of item.incomingStatusModifiers) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.kind === 'by_type') {
            if (args.statusType.id !== localMod.statusTypeId) return args.baseChance;
            return args.baseChance * localMod.chanceMultiplier;
          }
          if (!args.statusType.tags.includes(localMod.statusTag)) return args.baseChance;
          return args.baseChance * localMod.chanceMultiplier;
        },
      };
    }
  }
}

// Per-hook contributor registry. The dispatch is a single map lookup;
// hooks with no entry yield no equipment contributors. Adding equipment
// integration for a new hook is one entry plus the contributor body.
//
// The map's value type uses `EquipmentContributor<K>` keyed by `K in
// HookName` so each entry is a compile-time-checked match between hook
// name and contributor signature. The lookup site casts back to
// `EquipmentContributor<K>` because TypeScript can't infer the K
// relationship through the dynamic `hookName` parameter.
const EQUIPMENT_CONTRIBUTORS: { [K in HookName]?: EquipmentContributor<K> } = {
  modifyStatQuery: statQueryContributor,
  modifyMpCost: mpCostContributor,
  modifyActionSpeed: actionSpeedContributor,
  modifyResistance: resistanceContributor,
  modifyIncomingStatusApplicationChance: incomingStatusChanceContributor,
};

export function* equipmentContributionsFor<K extends HookName>(
  unit: Unit,
  catalog: Catalog,
  hookName: K,
): Generator<SourceContribution<K>> {
  const contributor = EQUIPMENT_CONTRIBUTORS[hookName] as EquipmentContributor<K> | undefined;
  if (contributor === undefined) return;
  yield* contributor(unit, catalog);
}
