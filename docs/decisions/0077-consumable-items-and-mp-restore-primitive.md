## ADR-0077: Consumable items + MP-restore primitive

**Status:** Accepted
**Date:** 2026-05-17
**Session:** 39a

## Context

Session 39 introduces the Alchemist's Compound + Throw Item action economy: bank a consumable into a per-unit stockpile on the Compound turn; spend it on a target on the Throw Item turn. The four v1 items (Potion / Phoenix Down / Remedy / Ether) need a catalog representation, a per-unit state shape for the stockpile, and reducers that apply the items' effects.

The substrate is genuinely new — the existing `ItemDefinition` is equipment-only (slot-discriminated weapons / shields / armor / headgear / accessories per ADR-0028). The S38 codebase has no notion of "consumable item" anywhere; the comment in `item-definition.ts` from ADR-0028 explicitly anticipated this: *"Consumables (potions, ethers, etc.) extend the union with `kind: 'consumable'` when they ship; the equipment-slot kinds stay an inner sum."*

Two design decisions here, both small but worth recording:

1. **How to model consumables in the catalog** — extend the union, parallel catalog, or inline content?
2. **How to model MP-restore** — Ether is the first MP-restore consumer in v1. Cure (the existing healing) reuses the damage pipeline with a `'healing'` tag; there's no parallel `'mp_restore'` tag because MP healing has no prior content.

## Decision

### (1) `ConsumableDefinition` as a `'kind': 'consumable'` variant of `ItemDefinition`

Per Chris's S39 plan-review (Q2: "Items as engine surface"):

```typescript
export interface ConsumableDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly kind: 'consumable';
  readonly availability: Availability;
  readonly compoundMpCost: number;
  readonly effects: ConsumableEffects;
}

export type ItemDefinition = EquipmentDefinition | ConsumableDefinition;
```

**`ConsumableEffects` shape:** discrete fields per effect kind rather than aliasing `AbilityEffects`. Items have no Faith/MA scaling on heals (the formula is fixed: caster.PA × coefficient), no reactions, no Charging, 100% accuracy. Modeling them with their own spec keeps Compound + Throw Item out of the ability pipeline entirely:

```typescript
export interface ConsumableEffects {
  readonly hpRestore?: { readonly coefficient: number };     // PA × coefficient, capped at maxHp
  readonly mpRestore?: { readonly coefficient: number };     // PA × coefficient, capped at maxMp
  readonly removeKO?: boolean;                                // revive on KO'd target (HP=1 + heal)
  readonly clearStatuses?: { readonly kind: 'debuff' };       // remove non-buff statuses
}
```

The four v1 items map cleanly:
- **Potion** — `{ hpRestore: { coefficient: 12 } }`, compoundMpCost 8.
- **Phoenix Down** — `{ removeKO: true, hpRestore: { coefficient: 4 } }`, compoundMpCost 12.
- **Remedy** — `{ clearStatuses: { kind: 'debuff' } }`, compoundMpCost 6.
- **Ether** — `{ mpRestore: { coefficient: 4 } }`, compoundMpCost 10.

Items live in the existing `catalog.items()` keyspace alongside equipment. A `ConsumableDefinition` cannot land in an equipment slot — `validateSlotItem` rejects with "expects equipment, received a consumable item" before kind-specific checks. Equipment paths (`iterateEquippedItems`, `readSlotAsWeapon`, `team-builder-state.classCanEquip`) narrow via the new `isEquipment(item: ItemDefinition): item is EquipmentDefinition` predicate.

### (2) Per-unit `stockpile: ReadonlyMap<ItemId, number>` field

Added to `Unit`. Default empty `Map`. Compound increments by 1; Throw Item decrements by 1 (and prunes the entry if the count reaches 0). Missing entries are 0 — `stockpile.get(id) ?? 0` is the canonical read.

No v1 cap (per Chris's S39 confirmation; "out of scope: stockpile cap"). The action surface is paying MP per item, which is the bottleneck.

Stockpile initialization is empty at battle start. S39b's Field Kit support populates a starting stockpile (`{ potion: 1, phoenix_down: 1, remedy: 1 }`) via a battle-setup hook.

### (3) New action kinds: `use_compound` + `use_throw_item`

Not folded into `use_ability`. Items aren't abilities; reactions don't trigger; the ability pipeline doesn't apply. Each gets its own validator + reducer:

**Compound:** self-targeted, 100% accuracy, gated by `actor.vitals.mp >= item.compoundMpCost` and `actor.stockpile` existing for the actor (always true — stockpile is required on Unit). Consumes one Act. The reducer deducts MP, increments stockpile, decrements Act budget atomically.

**Throw Item:** single-target (`AbilityTarget = { kind: 'unit', unitId }`), 100% accuracy, range 3 horizontal × 3 vertical with LoS. Range is a module-level constant `THROW_ITEM_RANGE` in `validate.ts` — all v1 items share it; per-item override could live on `ConsumableDefinition` later if a new item needs different reach.

Gates: actor has Act budget, actor has ≥1 of the item in stockpile, target exists and isn't `removed`. KO'd targets are accepted — Phoenix Down needs them, and non-revival items naturally apply gated zero per the standard `vitals.hp <= 0` checks.

The reducer's `applyConsumableEffects` runs effects in order: revive → hpRestore → mpRestore (emitted as `system_mp_restore`) → clearStatuses. Order matters: revive must precede hpRestore so the heal applies to a just-revived unit at HP=1.

### (4) `system_mp_restore` primitive

Symmetric to `system_heal` but writes MP instead of HP. Provenance discriminator includes `{ kind: 'throw_item'; itemId; casterId }` — the v1 producer. Bypasses Faith/MA/resistance (items are flat-coefficient by design); caps at `runModifyStatQuery(maxMp)`; KO'd / removed targets short-circuit to applied=0.

**Why a primitive vs. an inline mutation in `applyConsumableEffects`?** Two reasons:
1. **ADR-0074 absolutes:** the renderer settles MP from engine-reported absolutes (`mpAfter`), not from `snap.mp + applied`. Emitting as a system action gives the standard outcome shape (`{ amount, applied, mpAfter }`) that the renderer / log can consume without special-casing.
2. **Forward compat:** if a future content item / ability needs to restore MP (Magus Crown procs an MP heal on crit, a hypothetical "Mana Cycle" status, etc.), the substrate is in place.

The damage-pipeline parallel (extending the pipeline with an `'mp_restore'` damage tag the way `'healing'` works today) was considered and rejected: items deliberately bypass the pipeline. Mixing the two would entangle item application with reaction triggers and Faith/MA scaling that items don't want.

### (5) Existing-content impact: detail-text + equipment paths

The `formatItemDetail` UI helper assumed `item` was `EquipmentDefinition` and read several equipment-only fields (`statMods`, `bucketCapacityMods`, `evasionMods`, etc.). Updated to early-return into a new `formatConsumableDetail` for `item.kind === 'consumable'`. The consumable detail surfaces "Compound: MP N · Revives KO · Restores PA × N HP / MP · Clears negative statuses" lines from the effects spec.

Team-builder paths (`classCanEquip`, `draftBucketCapacity`) narrow with `isEquipment` before reading equipment-only fields. Consumables never appear in slots so the narrow always succeeds at runtime; the typecheck is satisfied.

## Consequences

**Catalog count moves from 42 → 46 items.** The `loader.test.ts` assertion is updated. Future Hi-Potion / Holy Water / Elixir items are pure content adds — no engine surface.

**Stockpile state composes with `removeOnSourceKO` and the existing on-KO cleanup.** Currently no status has `stockpile`-related cleanup behavior. If a future hypothetical "shared stockpile" item ships (one team-wide pool), the structural change would be in `GameState`, not on `Unit`.

**Throw Item bypasses all reaction-trigger surfaces.** A unit who throws a Phoenix Down at an ally won't trigger Counter even if the ally is Counter-equipped (items aren't damage-tagged). Worth confirming in playtest — if Counter-on-heal becomes a problem, that's an existing damage-pipeline gap, not an item one.

**MP-restore as a system action means it can be emitted by future content** — a Mana Cycle status ticking once per round, an MP-on-kill class trait, etc. The substrate lands here; new consumers are 1-line changes.

**No UI surfaces touch any of this in S39a.** Action-menu submenu for Compound, target-selector + item-picker for Throw Item, stockpile display in unit detail panel, permadeath countdown badge — all land in S39b.

## Alternatives considered

**Items as `availability: 'hidden'` abilities.** Each item is internally an `AbilityDefinition` with hidden availability; Compound and Throw Item dispatch the matching ability. Reuses the ability pipeline but conflates "thing thrown" with "thing castable" — every item would carry irrelevant fields (`actionSpeed`, `targeting`, `mpCost`, hit rolls). Rejected for surface clarity.

**Items inline within Throw Item.** Throw Item itself owns a switch on `itemId` and applies effects directly. No catalog entry per item. Smallest surface, ugliest extensibility — every new item edits Throw Item. Rejected for content authorability.

**Extending the damage pipeline with `'mp_restore'` tag** (parallel to `'healing'`). Reuses pipeline machinery — variance, resistance gating, cap clamping. Rejected: items shouldn't be subject to variance or resistance; flat-coefficient is the design. Adding gating "items skip these stages" would special-case the pipeline more than it saves.

**Per-item throw range on `ConsumableDefinition`.** Throw Item's range is hardcoded at `THROW_ITEM_RANGE` (3h × 3v) today. Adding a per-item range field would let a hypothetical Long Throw bomb reach further. Rejected for v1 — no consumer yet. The constant lives in `validate.ts` and can be promoted to a per-item field when a consumer ships.

**Stockpile as `Map<ItemId, StockpileEntry>` instead of `Map<ItemId, number>`.** The richer shape would carry per-instance state (e.g., "potion brewed by Beowulf vs. by Marach" for some future attribution mechanic). Rejected as overdesign — v1 items have no per-instance state and the count-only shape mirrors how players think about it.

## Notes for future sessions

- The four-item set ships in `src/content/items/`. Hi-Potion would be `{ hpRestore: { coefficient: 24 } }` with a higher compoundMpCost — pure content. Holy Water (`{ clearStatuses: { kind: 'undead' } }`) would extend `ConsumableStatusClearSpec` with a new discriminant. Elixir (`{ hpRestore: { coefficient: 100 }, mpRestore: { coefficient: 100 } }`) needs no new shape.
- Buff/debuff items (deferred per S39 out-of-scope) would add an `applyStatus?: StatusTypeId` field to `ConsumableEffects`. The status-application machinery on the engine side already exists (`system_apply_status`).
- A future Calculator class is expected to reuse the Compound submenu UX pattern (per the S39 brief's "Out of scope: Calculator class submenu pattern groundwork"). The action-economy substrate (use_compound / use_throw_item action kinds) doesn't generalize directly; Calculator likely needs its own action kind. But the catalog-as-consumable pattern + the per-unit stockpile pattern could compose if Calculator's "spells" are modeled as stocked-and-released entries.
