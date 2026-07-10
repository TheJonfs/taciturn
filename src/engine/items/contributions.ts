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
import { PROC_ROLL_SUB_STREAM, unitFloatFromSeed } from '../hooks/runners.ts';
import type {
  DamageTag,
  PartialBaseStats,
  ProposedAction,
  StatName,
  Unit,
} from '../types/index.ts';
import { enlargeAoeShape } from '../map/aoe.ts';
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
// the indirection is here so a stat with a different storage vs. query
// key (`maxHpBase` → `maxHp`, `maxMpBase` → `maxMp`) is added in one place.
const STAT_MOD_KEYS: ReadonlyArray<{ readonly statKey: keyof PartialBaseStats; readonly statName: StatName }> = [
  { statKey: 'spd', statName: 'spd' },
  { statKey: 'pa', statName: 'pa' },
  { statKey: 'ma', statName: 'ma' },
  { statKey: 'maxHpBase', statName: 'maxHp' },
  { statKey: 'maxMpBase', statName: 'maxMp' },
  { statKey: 'brave', statName: 'brave' },
  { statKey: 'faith', statName: 'faith' },
  // Session 29: Arcane Lens authors `+10 crit_chance` via statMods.
  // Storage and query key are identical (no maxHpBase-style mapping).
  { statKey: 'crit_chance', statName: 'crit_chance' },
];

// modifyStatQuery contributor: yields ADDITIVE handlers first (from
// `statMods`), then MULTIPLICATIVE handlers (from `statModsMultiplicative`).
// Within the Equipment tier, the per-handler `tieBreakIndex` orders all
// handlers — additives' indices come before multiplicatives', so the
// runner applies all additive deltas to baseValue, then all multiplicative
// factors. Per ADR-0058. Result: Wizard's Robe (+40 MP additive) +
// Staff of Abundance (×1.5 multiplicative) on a 60-base Mage composes as
// `(60 + 40) × 1.5 = 150`, not `(60 × 1.5) + 40 = 130`.
//
// The handler gates on `args.statName` so a unit reading 'pa' only sees
// the +PA contributions, not the +MA ones. The multiplicative handler
// keys directly off `statName` (no storage→query mapping) because
// `statModsMultiplicative` is authored against StatName already.
function* statQueryContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyStatQuery'>> {
  let tieBreakIndex = 0;
  // Pass 1: additive deltas from `statMods` (BaseStats-keyed).
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
  // Pass 1b: additive deltas from `movementMods` for moveRange / jump
  // (StatName-keyed; these don't live on BaseStats — they come from
  // ClassMovementBaseline). Lightfoot writes `{ moveRange: 1, jump: 1 }`.
  // Yielded alongside the BaseStats-additive pass so all additives still
  // run before any multiplicative.
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.movementMods === undefined) continue;
    for (const [statNameKey, delta] of Object.entries(item.movementMods)) {
      if (delta === undefined || delta === 0) continue;
      const localIndex = tieBreakIndex++;
      const localStatName = statNameKey as StatName;
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
  // Pass 2: multiplicative factors from `statModsMultiplicative`
  // (StatName-keyed). Yielded after every additive handler so all
  // additives apply before any multiplicative — ADR-0058's composition
  // order rule. Factor 1.0 short-circuits (no-op handler).
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    const multiplicative = item.statModsMultiplicative;
    if (multiplicative === undefined) continue;
    for (const [statNameKey, factor] of Object.entries(multiplicative)) {
      if (factor === undefined || factor === 1) continue;
      const localIndex = tieBreakIndex++;
      const localStatName = statNameKey as StatName;
      const localFactor = factor;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (args.statName !== localStatName) return args.baseValue;
          return args.baseValue * localFactor;
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
// declares additive deltas, optionally gated on the ability's tags —
// the UNION of ability-level tags and damage tags (TABA M3 fix, Chris's
// call). The original read was damage-tags-only, which silently skipped
// buff casts (no damage spec → no tags → no match), contradicting Livre
// of Urgency's documented "+5 on every magical cast". Damage spells
// carry identical tags at both levels (e.g. Earth Strike:
// ['magical','earth'] ability AND damage), so the union preserves every
// damage-spell gating exactly while making buff casts (tags:
// ['magical'], no damage) match as documented. Consumers: Wand of
// Deepwood (['earth']), Livre of Urgency (['magical']), Choir Staff
// (['magical'] — the buff-caster tempo staff that surfaced the bug).
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
            const abilityTags = [
              ...(args.ability.tags ?? []),
              ...(args.ability.effects.damage?.tags ?? []),
            ];
            const matches = localFilter.some((t: DamageTag) => abilityTags.includes(t));
            if (!matches) return args.baseActionSpeed;
          }
          return args.baseActionSpeed + localDelta;
        },
      };
    }
  }
}

// modifySpellPower contributor (Session 68): each item's
// `spellPowerModifiers` declares additive Spell Power (magical
// `power_coefficient`) deltas, optionally gated on the ability's damage
// tags. Wand of Potential authors `{ delta: 1, tagFilter: ['lightning']
// }` so only the holder's lightning-tagged magic gains +1 SP.
// Mirror of `actionSpeedContributor`'s tag-gating: a filtered handler
// inspects `args.ability.effects.damage?.tags` and no-ops when the
// ability carries none of the listed tags. Holder-gating is implicit —
// this walks the caster's own equipped items.
function* spellPowerContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifySpellPower'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.spellPowerModifiers === undefined) continue;
    for (const mod of item.spellPowerModifiers) {
      const localIndex = tieBreakIndex++;
      const localDelta = mod.delta;
      const localFilter = mod.tagFilter;
      const localPerExtraTarget = mod.perExtraTarget === true;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localFilter !== undefined) {
            const abilityTags = args.ability.effects.damage?.tags;
            if (abilityTags === undefined) return args.baseValue;
            const matches = localFilter.some((t: DamageTag) => abilityTags.includes(t));
            if (!matches) return args.baseValue;
          }
          // S74: Glove of Metria's per-extra-target scaling — +delta for
          // each target beyond the first (single-target casts get nothing).
          const effectiveDelta = localPerExtraTarget
            ? localDelta * Math.max(0, args.targetCount - 1)
            : localDelta;
          return args.baseValue + effectiveDelta;
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
  // TABA M3 — stat-scaled arm: `resistanceFromMaTags` adds the wearer's
  // composed MA (pre-computed by composeResistance, the modifyWeaponPower
  // `pa` precedent) to each listed tag. Abjurer's Codex authors the four
  // elements. Additive with the flat arm above.
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.resistanceFromMaTags === undefined) continue;
    const localIndex = tieBreakIndex++;
    const localTags = item.resistanceFromMaTags;
    yield {
      tier: 'equipment',
      priority: DEFAULT_HOOK_PRIORITY,
      tieBreakIndex: localIndex,
      invoke: (args) => {
        if (!localTags.includes(args.tag)) return args.baseValue;
        return args.baseValue + args.ma;
      },
    };
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
  // TABA M3 — stat-scaled arm: `incomingStatusStatShrugs` multiplies the
  // land chance of a matching incoming status by `(1 − max(PA, MA)/100)`,
  // floored at 0 (PA/MA pre-composed by the runner). Multiplicative like
  // the flat arm, so stacking with Focus Band can approach but never
  // reach immunity. Talisman of Endurance authors `[{ statusTag:
  // 'negative' }]`.
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.incomingStatusStatShrugs === undefined) continue;
    for (const mod of item.incomingStatusStatShrugs) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.statusTypeId !== undefined && args.statusType.id !== localMod.statusTypeId) {
            return args.baseChance;
          }
          if (localMod.statusTag !== undefined && !args.statusType.tags.includes(localMod.statusTag)) {
            return args.baseChance;
          }
          const factor = Math.max(0, 1 - Math.max(args.pa, args.ma) / 100);
          return args.baseChance * factor;
        },
      };
    }
  }
}

// modifyOutgoingStatusMagnitude contributor (S74, ADR-0128): each item's
// `outgoingStatusMagnitudeMods` declares multiplicative factors on the
// magnitude of a status the WEARER applies, gated on the outgoing status's
// type or tag set (both omitted → every outgoing status). Pendant of
// Lumara: `[{ statusTypeId: 'burn', factor: 2 }]` doubles the wearer's
// Burn. Composes multiplicatively alongside Aura Mastery's buff amplifier
// — which gates on `amplifiable` (Burn isn't), so they don't collide.
function* outgoingStatusMagnitudeContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyOutgoingStatusMagnitude'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.outgoingStatusMagnitudeMods === undefined) continue;
    for (const mod of item.outgoingStatusMagnitudeMods) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.statusTypeId !== undefined && args.statusType.id !== localMod.statusTypeId) {
            return args.baseMagnitude;
          }
          if (localMod.statusTag !== undefined && !args.statusType.tags.includes(localMod.statusTag)) {
            return args.baseMagnitude;
          }
          return args.baseMagnitude * localMod.factor;
        },
      };
    }
  }
}

// modifyOutgoingStatusDuration contributor (TABA M3): each item's
// `outgoingStatusDurationMods` declares additive duration deltas on
// finite statuses the WEARER applies, gated on the outgoing status's
// type or tag (both omitted → every outgoing finite status). Choir
// Staff: `[{ delta: 1, statusTag: 'positive' }]` — the wearer's buffs
// last one extra duration unit. Mirrors the outgoing-magnitude
// contributor's gating shape.
function* outgoingStatusDurationContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyOutgoingStatusDuration'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.outgoingStatusDurationMods === undefined) continue;
    for (const mod of item.outgoingStatusDurationMods) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.statusTypeId !== undefined && args.statusTypeId !== localMod.statusTypeId) {
            return args.baseDuration;
          }
          if (localMod.statusTag !== undefined && !args.statusTags.includes(localMod.statusTag)) {
            return args.baseDuration;
          }
          return args.baseDuration + localMod.delta;
        },
      };
    }
  }
}

// modifyBucketCapacity contributor: each item's `bucketCapacityMods`
// declares per-bucket additive deltas (Steel Helm `{ reaction: 1 }`,
// Augmentor `{ support: 1 }`, Magus Crown `{ first_action: 1 }`).
// The handler gates on `args.bucket`; mismatched buckets return the
// running value unchanged. Per ADR-0059.
function* bucketCapacityContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyBucketCapacity'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.bucketCapacityMods === undefined) continue;
    for (const [bucket, delta] of item.bucketCapacityMods) {
      if (delta === 0) continue;
      const localIndex = tieBreakIndex++;
      const localBucket = bucket;
      const localDelta = delta;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (args.bucket !== localBucket) return args.baseCapacity;
          return args.baseCapacity + localDelta;
        },
      };
    }
  }
}

// modifyStatusTickAmount contributor: each item's
// `statusTickAmountMultipliers` declares multiplicative factors gated
// on the ticking status's type or tag set. Purifier authors
// `[{ factor: 2, statusTag: 'negative' }]`. Per ADR-0060.
function* statusTickAmountContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyStatusTickAmount'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.statusTickAmountMultipliers === undefined) continue;
    for (const mod of item.statusTickAmountMultipliers) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.statusTypeId !== undefined && args.statusTypeId !== localMod.statusTypeId) {
            return args.baseAmount;
          }
          if (localMod.statusTag !== undefined && !args.statusTags.includes(localMod.statusTag)) {
            return args.baseAmount;
          }
          return args.baseAmount * localMod.factor;
        },
      };
    }
  }
}

// modifyStatusApplicationStackCount contributor (Session 45 follow-up,
// ADR-0084): source-side stack-count adjustment, gated on status type
// / tag and on the source ability's tags. Wand of Lumen authors
// `[{ delta: 1, statusTypeId: 'burn', sourceAbilityTagAll: ['fire'] }]`
// → +1 Burn stack when its wielder casts a fire-tagged ability. Single
// modifier pass per application; no re-entry into `applyStatus`.
function* statusApplicationStackCountContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyStatusApplicationStackCount'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.statusApplicationStackCountModifiers === undefined) continue;
    for (const mod of item.statusApplicationStackCountModifiers) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.statusTypeId !== undefined && args.statusTypeId !== localMod.statusTypeId) {
            return args.baseCount;
          }
          if (localMod.statusTag !== undefined && !args.statusTags.includes(localMod.statusTag)) {
            return args.baseCount;
          }
          if (localMod.sourceAbilityTagAll !== undefined) {
            for (const t of localMod.sourceAbilityTagAll) {
              if (!args.sourceAbilityTags.includes(t)) return args.baseCount;
            }
          }
          return args.baseCount + localMod.delta;
        },
      };
    }
  }
}

// modifyAbilityRange contributor: each item's `abilityRangeModifiers`
// declares per-axis additive deltas, optionally gated on the ability's
// damage tags. Wand of Depths: `+1` horizontal/`+1` vertical on
// `water`-tagged spells. The handler reads `args.ability.effects.damage?.tags`
// to gate. Per Session 29.
function* abilityRangeContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyAbilityRange'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.abilityRangeModifiers === undefined) continue;
    for (const mod of item.abilityRangeModifiers) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localMod.tagFilter !== undefined) {
            const abilityTags = args.ability.effects.damage?.tags;
            if (abilityTags === undefined) return { horizontal: args.baseHorizontal, vertical: args.baseVertical };
            const matches = localMod.tagFilter.some((t: DamageTag) => abilityTags.includes(t));
            if (!matches) return { horizontal: args.baseHorizontal, vertical: args.baseVertical };
          }
          return {
            horizontal: args.baseHorizontal + (localMod.deltaHorizontal ?? 0),
            vertical: args.baseVertical + (localMod.deltaVertical ?? 0),
          };
        },
      };
    }
  }
}

// S51: modifyAoeVerticalTolerance contributor. Mirrors the abilityRange
// contributor's tag-filter shape: each `aoeVerticalToleranceModifiers`
// entry adds a delta to the running tolerance, optionally gated on the
// ability's damage tags. Battle Dictionary (+1, tagFilter ['magical']) and
// the Wand of the Depths refit (+1, tagFilter ['water']) consume this.
// Composes alongside Aether Bloom's existing passive-side handler.
function* aoeVerticalToleranceContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyAoeVerticalTolerance'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.aoeVerticalToleranceModifiers === undefined) continue;
    for (const mod of item.aoeVerticalToleranceModifiers) {
      const localIndex = tieBreakIndex++;
      const localDelta = mod.delta;
      const localFilter = mod.tagFilter;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localFilter !== undefined) {
            const abilityTags = args.ability.tags ?? [];
            const matches = localFilter.some((t: DamageTag) => abilityTags.includes(t));
            if (!matches) return args.baseValue;
          }
          return args.baseValue + localDelta;
        },
      };
    }
  }
}

// modifyAoeShape contributor (TABA M3): each item's
// `aoeShapeEnlargeModifiers` declares shape-step growth on the wearer's
// AoE casts, optionally gated on the ability's tag list (Aether Bloom
// convention — ability tags, not damage tags). Each step applies
// `enlargeAoeShape` once (diamond/square/cross radius +1, line length
// +1; cone/custom pass through unchanged). Wand of Expanse authors
// `[{ steps: 1, tagFilter: ['magical'] }]`; the chain composes with
// Aether Bloom's passive-side handler for +2-step blooms.
function* aoeShapeEnlargeContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyAoeShape'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.aoeShapeEnlargeModifiers === undefined) continue;
    for (const mod of item.aoeShapeEnlargeModifiers) {
      if (mod.steps <= 0) continue;
      const localIndex = tieBreakIndex++;
      const localSteps = mod.steps;
      const localFilter = mod.tagFilter;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (localFilter !== undefined) {
            const abilityTags = args.ability.tags ?? [];
            const matches = localFilter.some((t) => abilityTags.includes(t));
            if (!matches) return args.baseShape;
          }
          let shape = args.baseShape;
          for (let i = 0; i < localSteps; i++) shape = enlargeAoeShape(shape);
          return shape;
        },
      };
    }
  }
}

// modifyOutgoingHitChance contributor: each item's
// `outgoingHitChanceMultipliers` declares multiplicative factors
// (Arcane Lens × 1.10). Caster-side, composes after the target-side
// `modifyHitChance` chain inside `evasionCheck`. Per Session 29.
function* outgoingHitChanceContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyOutgoingHitChance'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.outgoingHitChanceMultipliers === undefined) continue;
    for (const factor of item.outgoingHitChanceMultipliers) {
      const localIndex = tieBreakIndex++;
      const localFactor = factor;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => args.baseHitChance * localFactor,
      };
    }
  }
}

// modifyEvasion contributor: each item's `evasionMods` declares per-
// facing additive deltas (Steel Helm `{ side: -20, back: -20 }`). One
// handler per item; the handler reads `args.facing` and adds the
// matching delta to the running evasion. Negative deltas are valid
// (they produce hit-chance > weapon accuracy from the targeted facing,
// clamped at the existing damage-pipeline exit). Per Session 29.
function* evasionContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifyEvasion'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.evasionMods === undefined) continue;
    const mods = item.evasionMods;
    const localIndex = tieBreakIndex++;
    const localMods = mods;
    yield {
      tier: 'equipment',
      priority: DEFAULT_HOOK_PRIORITY,
      tieBreakIndex: localIndex,
      invoke: (args) => {
        const delta =
          args.facing === 'front'
            ? localMods.front
            : args.facing === 'side'
              ? localMods.side
              : localMods.back;
        if (delta === undefined || delta === 0) return args.baseEvasion;
        return args.baseEvasion + delta;
      },
    };
  }
}

// onDamageDealt contributor: each item's `attackProcs` declares
// (chance, abilityId) entries that fire `use_ability` against the
// original target when a physical hit lands. Per ADR-0064 (Session 30).
//
// Gates (handler-side, so author intent is preserved across all sources):
//  - ctx.hit must be true (no proc on a miss).
//  - ctx.damageTags must include 'physical' (procs trigger on weapon
//    hits, not on spells the wielder casts — per Chris's design call).
//  - ctx.actionSeed must be present (handlers without a seed can't roll
//    deterministically; pipeline always provides one).
//
// Determinism: each proc handler is assigned a stable contributor-wide
// `procIndex`; the per-action roll is `unitFloatFromSeed(actionSeed ^
// (PROC_ROLL_SUB_STREAM + procIndex))`. Same action seed + same item
// load produces the same proc pattern across replays.
//
// Emission: on a roll under `chance`, the handler emits a `use_ability`
// against ctx.target with `riderSource: { kind: 'equipment_proc', itemId }`.
// The reducer's MP-deduction and `onActionAttempted` veto gates read
// the rider flag and skip — see ADR-0064 for the bypass rationale
// (the proc is the weapon's power, not the wielder's). Procs share
// chain-depth with reactions and are bounded by the existing cap.
function* attackProcContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onDamageDealt'>> {
  let tieBreakIndex = 0;
  let procIndex = 0;
  for (const { slot, item } of iterateEquippedItems(unit, catalog)) {
    if (item.attackProcs === undefined) continue;
    for (const proc of item.attackProcs) {
      const localIndex = tieBreakIndex++;
      const localProcIndex = procIndex++;
      const localChance = proc.chance;
      const localAbilityId = proc.abilityId;
      const localItemId = item.id;
      const localAttackerId = unit.id;
      const localSlot = slot;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          const ctx = args.ctx;
          if (!ctx.hit) return ctx;
          if (!ctx.damageTags.has('physical')) return ctx;
          if (ctx.actionSeed === undefined) return ctx;
          // Per-swing weapon scope (Session 42): a multi-swing attack
          // sets `attackingWeaponSlot`; only the swinging slot's procs
          // roll on that swing (a Magebane in the off-hand procs Silence
          // on the off-hand swing only). Undefined → no scoping (every
          // single-weapon / pre-S42 attack fires all equipped procs).
          if (ctx.attackingWeaponSlot !== undefined && ctx.attackingWeaponSlot !== localSlot) {
            return ctx;
          }
          const subSeed = (ctx.actionSeed ^ ((PROC_ROLL_SUB_STREAM + localProcIndex) >>> 0)) >>> 0;
          const roll = unitFloatFromSeed(subSeed);
          if (roll >= localChance) return ctx;
          const emission: ProposedAction = {
            type: 'use_ability',
            source: 'system',
            actorId: localAttackerId,
            payload: {
              abilityId: localAbilityId,
              target: { kind: 'unit', unitId: ctx.target.id },
              riderSource: { kind: 'equipment_proc', itemId: localItemId },
            },
          };
          return { ctx, emittedActions: [emission] };
        },
      };
    }
  }
}

// onFinalDamage contributor: each item's `damageMpDrainPercent` declares
// a percentage (0-100) of final damage to drain from the target's MP
// into the wearer's. Per ADR-0065 (Session 30). Rasp Pendant (Session 31)
// authors `10`.
//
// Gates:
//  - The damage was not absorbed (resistance > 100 flip — no MP drain
//    when no damage actually landed; per Chris's design call).
//  - `damageDealt > 0` (zero damage means no drain to compute).
//  - `floor(damageDealt × percent / 100) > 0` (rounding produced
//    something to drain; otherwise no emission for log cleanliness).
//  - The target is not KO'd (Rasp Pendant's spec says no drain on a
//    KO'd target; the reducer also no-ops on KO'd targets, but gating
//    here keeps the action log free of trivial zero-amount entries).
//
// Emission: `system_mp_drain { source: attacker.id, target: target.id,
// amount }`. The reducer applies the transfer-bounded math (target floor
// at 0, source cap at maxMp).
function* finalDamageDrainContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onFinalDamage'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.damageMpDrainPercent === undefined) continue;
    if (item.damageMpDrainPercent <= 0) continue;
    const localIndex = tieBreakIndex++;
    const localPercent = item.damageMpDrainPercent;
    const localAttackerId = unit.id;
    yield {
      tier: 'equipment',
      priority: DEFAULT_HOOK_PRIORITY,
      tieBreakIndex: localIndex,
      invoke: (args) => {
        if (args.absorbed) return {};
        if (args.damageDealt <= 0) return {};
        if (args.target.vitals.hp <= 0) return {};
        const amount = Math.floor((args.damageDealt * localPercent) / 100);
        if (amount <= 0) return {};
        const emission: ProposedAction = {
          type: 'system_mp_drain',
          source: 'system',
          payload: {
            source: localAttackerId,
            target: args.target.id,
            amount,
          },
        };
        return { emittedActions: [emission] };
      },
    };
  }
}

// onFinalDamage CT-drain contributor (S74, ADR-0126): each item's
// `damageCtDrainPercent` declares a percentage (0-100) of final *magical*
// damage to drain from the target's CT. Ring of Caliora authors `20`.
//
// Gates (mirror the MP-drain contributor, plus the magical gate):
//  - the hit was magical (`damageTags.has('magical')`) — the Ring rewards
//    spellcasting, not weapon hits.
//  - not absorbed (resistance > 100 flip — no drain when nothing landed).
//  - `damageDealt > 0`.
//  - `floor(damageDealt × percent / 100) > 0` (log cleanliness).
//  - the target is not KO'd (the CT-push reducer also no-ops on KO'd
//    targets; gating here keeps the log free of zero-effect entries).
//
// Emission: `system_ct_push { targetId, delta: -amount, source: {
// kind: 'equipment_ct_drain', itemId, attackerId } }`. The reducer floors
// the target's CT at 0 — the only guardrail (no per-hit cap, per Chris's
// S74 call). Field-wide on a Calculator's Math Skill this drains CT off
// every matched enemy per cast (the flagged tempo soft-lock — a
// playtest-watch item, deliberately shipped uncapped to feel out).
function* finalDamageCtDrainContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onFinalDamage'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.damageCtDrainPercent === undefined) continue;
    if (item.damageCtDrainPercent <= 0) continue;
    const localIndex = tieBreakIndex++;
    const localPercent = item.damageCtDrainPercent;
    const localItemId = item.id;
    const localAttackerId = unit.id;
    yield {
      tier: 'equipment',
      priority: DEFAULT_HOOK_PRIORITY,
      tieBreakIndex: localIndex,
      invoke: (args) => {
        if (args.absorbed) return {};
        if (args.damageDealt <= 0) return {};
        if (!args.damageTags.has('magical')) return {};
        if (args.target.vitals.hp <= 0) return {};
        const amount = Math.floor((args.damageDealt * localPercent) / 100);
        if (amount <= 0) return {};
        const emission: ProposedAction = {
          type: 'system_ct_push',
          source: 'system',
          payload: {
            targetId: args.target.id,
            delta: -amount,
            source: { kind: 'equipment_ct_drain', itemId: localItemId, attackerId: localAttackerId },
          },
        };
        return { emittedActions: [emission] };
      },
    };
  }
}

// Composes the two equipment `onFinalDamage` riders (MP drain + CT drain)
// into one contributor, since the hook map holds a single entry per hook.
function* finalDamageContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onFinalDamage'>> {
  yield* finalDamageDrainContributor(unit, catalog);
  yield* finalDamageCtDrainContributor(unit, catalog);
}

// onFinalDamageReceived contributor (Session 37): each item's
// `physicalReflectPercent` declares a percentage (0-100) of incoming
// physical damage to reflect back at the attacker as a revenge-sourced
// `system_damage`. Spiked Mail authors `20`.
//
// Gates:
//  - `damageTags.has('physical')` — magical hits don't reflect.
//  - !absorbed — resistance > 100 tag-flip skips reflect (no damage
//    actually landed; matches Rasp Pendant's gate).
//  - `damageDealt > 0` — zero damage produces no reflect.
//  - `floor(damageDealt × percent / 100) > 0` — rounding produced a
//    non-zero amount.
//  - wearer is not KO'd (engagement-inactive — wearer can't reflect
//    posthumously).
//  - attacker !== wearer — self-damage doesn't reflect on the wearer.
//
// Emission: `system_damage { targetId: attacker.id, amount, tags:
// ['physical'], source: { kind: 'revenge', wearerId, itemId } }`. The
// revenge emission bypasses the damage pipeline (per system_damage
// semantics), so it can't trigger further reflects regardless of the
// attacker's gear — the loop guard is automatic.
function* physicalReflectContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onFinalDamageReceived'>> {
  // TABA M3: generalized over the reflect kind — `physicalReflectPercent`
  // (Spiked Mail, Session 37) and `magicalReflectPercent` (Mirror Shield)
  // share every gate; only the triggering tag and the revenge emission's
  // tag differ. Wearing both covers both damage kinds.
  const KINDS = [
    { field: 'physicalReflectPercent', tag: 'physical' },
    { field: 'magicalReflectPercent', tag: 'magical' },
  ] as const;
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    for (const { field, tag } of KINDS) {
      const percent = item[field];
      if (percent === undefined || percent <= 0) continue;
      const localIndex = tieBreakIndex++;
      const localPercent = percent;
      const localTag = tag;
      const localWearerId = unit.id;
      const localItemId = item.id;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          if (!args.damageTags.has(localTag)) return {};
          if (args.absorbed) return {};
          if (args.damageDealt <= 0) return {};
          if (args.unit.vitals.hp <= 0) return {};
          if (args.attacker.id === localWearerId) return {};
          const amount = Math.floor((args.damageDealt * localPercent) / 100);
          if (amount <= 0) return {};
          const emission: ProposedAction = {
            type: 'system_damage',
            source: 'system',
            payload: {
              targetId: args.attacker.id,
              amount,
              tags: [localTag],
              source: { kind: 'revenge', wearerId: localWearerId, itemId: localItemId },
            },
          };
          return { emittedActions: [emission] };
        },
      };
    }
  }
}

// onDamageReceived contributor (TABA M3): each item's
// `conditionalIncomingDamageMods` declares status-conditional incoming-
// damage multipliers — Damage Reduction's multiplier pattern, gated on
// the WEARER carrying the named status (and optionally on the incoming
// damage tags). Channeler's Hat authors `[{ factor: 0.5,
// whileStatusTypeId: 'charging' }]`: −50% incoming while charging.
// Healing-tagged events never match.
function* conditionalIncomingDamageContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'onDamageReceived'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.conditionalIncomingDamageMods === undefined) continue;
    for (const mod of item.conditionalIncomingDamageMods) {
      const localIndex = tieBreakIndex++;
      const localMod = mod;
      const localItemId = item.id;
      yield {
        tier: 'equipment',
        priority: DEFAULT_HOOK_PRIORITY,
        tieBreakIndex: localIndex,
        invoke: (args) => {
          const ctx = args.ctx;
          if (ctx.damageTags.has('healing')) return ctx;
          if (!args.unit.statuses.some((s) => s.typeId === localMod.whileStatusTypeId)) {
            return ctx;
          }
          if (localMod.tagFilter !== undefined) {
            const matches = localMod.tagFilter.some((t) => ctx.damageTags.has(t));
            if (!matches) return ctx;
          }
          return {
            ctx: {
              ...ctx,
              multipliers: [
                ...ctx.multipliers,
                { source: String(localItemId), factor: localMod.factor },
              ],
            },
          };
        },
      };
    }
  }
}

// ADR-0080 (Session 42): swings-per-weapon multiplier from equipment.
// The Offering authors `attackSwingMultiplier: 2`. Yields a
// `modifySwingsPerWeapon` handler that multiplies the running count.
// The basic-Attack / non-reaction gating lives at the call site
// (`attackingWeaponSlots`); this contributor is a pure capability.
function* swingsPerWeaponContributor(
  unit: Unit,
  catalog: Catalog,
): Generator<SourceContribution<'modifySwingsPerWeapon'>> {
  let tieBreakIndex = 0;
  for (const { item } of iterateEquippedItems(unit, catalog)) {
    if (item.attackSwingMultiplier === undefined) continue;
    if (item.attackSwingMultiplier <= 1) continue;
    const localIndex = tieBreakIndex++;
    const localMultiplier = item.attackSwingMultiplier;
    yield {
      tier: 'equipment',
      priority: DEFAULT_HOOK_PRIORITY,
      tieBreakIndex: localIndex,
      invoke: (args) => args.baseValue * localMultiplier,
    };
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
  // Session 68: Wand of Potential's +1 Spell Power on lightning magic.
  modifySpellPower: spellPowerContributor,
  modifyResistance: resistanceContributor,
  modifyIncomingStatusApplicationChance: incomingStatusChanceContributor,
  // S74 (ADR-0128): Pendant of Lumara's outgoing-Burn amplifier.
  modifyOutgoingStatusMagnitude: outgoingStatusMagnitudeContributor,
  // TABA M3: Choir Staff's outgoing-buff duration extender.
  modifyOutgoingStatusDuration: outgoingStatusDurationContributor,
  modifyBucketCapacity: bucketCapacityContributor,
  modifyStatusTickAmount: statusTickAmountContributor,
  modifyStatusApplicationStackCount: statusApplicationStackCountContributor,
  modifyAbilityRange: abilityRangeContributor,
  // S51: equipment-driven AoE vertical-tolerance modifier (Battle
  // Dictionary, Wand of the Depths refit).
  modifyAoeVerticalTolerance: aoeVerticalToleranceContributor,
  // TABA M3: Wand of Expanse's AoE shape growth (equipment-side Aether
  // Bloom).
  modifyAoeShape: aoeShapeEnlargeContributor,
  modifyOutgoingHitChance: outgoingHitChanceContributor,
  modifyEvasion: evasionContributor,
  // ADR-0080 (Session 42): The Offering's swings-per-weapon multiplier.
  modifySwingsPerWeapon: swingsPerWeaponContributor,
  // ADR-0064 (Session 30): weapon spell-cast riders.
  onDamageDealt: attackProcContributor,
  // TABA M3: Channeler's Hat's while-charging damage reduction.
  onDamageReceived: conditionalIncomingDamageContributor,
  // ADR-0065 (Session 30): damage-to-MP-drain on equipment.
  // S74 (ADR-0126): + Ring of Caliora's magical CT drain, composed in.
  onFinalDamage: finalDamageContributor,
  // Session 37: physical-reflect on body armor (Spiked Mail).
  onFinalDamageReceived: physicalReflectContributor,
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
