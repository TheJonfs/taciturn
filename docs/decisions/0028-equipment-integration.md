## ADR-0028: Equipment integration

**Status:** Accepted
**Date:** 2026-05-08
**Supersedes (in part):** ADR-0014 (the no-rename clause)

## Context

ADR-0014 deferred equipment integration to session 17, alongside the Knight expansion. Session 17c is that landing point. Equipment integration is the foundational engine work for the session: it introduces the `Equipment` type, equipment slots on units and classes, and the WP-as-a-real-factor refactor that ADR-0014 anticipated.

In addition, the Knight content sliced into 17c surfaces requirements that aren't strictly equipment but are bundled here because they have no other natural home and benefit from being decided at one time:

- A customizable status-application formula (Stasis Sword wants Brave_factor + MA_factor; Earth Magic wants Faith_factor + MA_factor; future PA-based abilities are foreseen).
- An `applyAlways` opt-out from the status-application formula (Taunt always lands).
- A `modifyEvasion` hook (Bulwark Stance modifies front evasion; class evasion is read inside the damage pipeline today and has no chain runner).
- An auto-removal mechanism for source-anchored statuses when the source unit KOs (Taunted's source disappearing leaves the status in a semantically odd place).
- A weapon-tag-composition rule for ability damage (so a Fire Sword carries `'fire'` into the resolved tag set without each ability re-declaring it).

The session-13.7 reconciliation explicitly placed equipment work here, and these adjacent decisions land best with the equipment shape rather than scattered across one-off ADRs that all reach into the same files.

## Decision

### Equipment shape

`EquipmentDefinition` is a discriminated union over the four slot kinds, sharing a common fields base:

```ts
interface EquipmentBase {
  readonly id: ItemId;
  readonly name: string;
  readonly statMods?: PartialBaseStats;     // additive PA / MA / maxHpBase / etc.
  readonly statusGrants?: ReadonlyArray<StatusTypeId>;  // applied at battle start
  readonly tags?: ReadonlyArray<DamageTag>; // composed onto weapon-tagged damage
}

interface WeaponEquipment   extends EquipmentBase { readonly kind: 'weapon';   readonly wp: number; readonly accuracy: number }
interface ArmorEquipment    extends EquipmentBase { readonly kind: 'armor' }
interface HeadgearEquipment extends EquipmentBase { readonly kind: 'headgear' }
interface AccessoryEquipment extends EquipmentBase { readonly kind: 'accessory' }

type EquipmentDefinition = WeaponEquipment | ArmorEquipment | HeadgearEquipment | AccessoryEquipment;
```

The catalog's `ItemDefinition` is `EquipmentDefinition` for v1. Consumables, when they ship, extend the union with `kind: 'consumable'`.

`statMods` is a `Partial<BaseStats>` — any base stat can be additively buffed. Equipment stat-mods register as `modifyStatQuery` handlers from the equipment source tier.

`statusGrants` is a list of `StatusTypeId`s applied to the wearer at `createInitialState` with `StatusInstanceSource = { unitId: null, actionSeq: null, kind: 'equipment', equipmentId }`. The status itself uses whichever duration mode it wants — Boots of Haste's Haste uses `permanent_per_unit_ct` so there's no decrement timer.

`tags` on weapon equipment compose into damage tags when an ability's `damage.tags` includes `'weapon'`. Non-weapon equipment can declare tags too (e.g., a future "armor that reflects fire damage"); the weapon-merge path is the v1 consumer.

### Unit equipment slots

Five slots: `leftHand | rightHand | headgear | armor | accessory`. Weapons can occupy either hand (foundation for two-weapons / shields when content arrives). v1 has no two-handed-only or shield-only weapons.

```ts
interface UnitEquipment {
  readonly leftHand:  ItemId | null;
  readonly rightHand: ItemId | null;
  readonly headgear:  ItemId | null;
  readonly armor:     ItemId | null;
  readonly accessory: ItemId | null;
}
```

`Unit.equipment` is added; `UnitPlacement.equipment` mirrors it. Equipment is set at placement time; mid-battle equipment changes (theft, equipment-break) are out of scope for v1.

### `ClassDefinition.equipmentSlots`

Classes declare which slots they support. v1 ships with all five for every class — Knight included. Future Mage classes can drop, e.g., `armor` if their identity is "robe-only."

```ts
interface ClassEquipmentSlots {
  readonly leftHand:  boolean;
  readonly rightHand: boolean;
  readonly headgear:  boolean;
  readonly armor:     boolean;
  readonly accessory: boolean;
}
```

`createInitialState` validates that each placement's equipped item lands in a slot the class supports and matches the slot's expected kind (weapons in hand slots, headgear in headgear slot, etc.).

### Hook source: equipment

Equipment registers handlers through the existing source-tier system. `Equipment` is already first in `DEFAULT_HOOK_SOURCE_TIER_ORDER`. The collector grows an Equipment-source branch parallel to Class / Passive / Status: it walks the unit's five slots, dereferences each non-null item, and emits handlers from:

- `statMods` → `modifyStatQuery` handlers, one per stat declared.
- `tags` → no hook; read inline by `physicalPaWp` and `evasionCheck` (the read happens through a helper, `getEquippedWeapon(unit)`).

`statusGrants` is *not* a hook — the statuses themselves register their own hooks once applied. The grant just kicks off the application at battle start.

### Equipment-sourced status: immune to in-battle removal

`StatusInstanceSource` gains an optional `kind: 'unit' | 'equipment' | null` discriminator (default 'unit' when omitted to keep backward compat). `removeStatus` and any reducer path that proposes a `status_remove` checks the source kind: if `'equipment'`, the removal is silently rejected (no throw — status-stripping abilities should be no-ops against equipment sources, not error out).

Mid-battle equipment removal would also need to remove the equipment-anchored statuses; that's deferred. v1 has no mid-battle equipment changes.

### Battle-start HP and MP fill

`createInitialState` computes max HP and max MP per unit from base + equipment + class + free-passive contributions, then sets `vitals.hp = computed_max_hp` and `vitals.mp = computed_max_mp`. Concretely: after building the unit, run `modifyStatQuery` for `'maxHp'` (and once we add it, `'maxMp'`) and set vitals to the result. This means a Knight with Iron Mail + Iron Helm starts at 110 HP, not 60.

`UnitPlacement.vitals` becomes optional: when omitted, both fields are filled from computed maxes. Authors who want a unit to start damaged still pass `vitals: { hp, mp }` explicitly.

Mid-battle equipment removal recomputing maxes is downstream — flagged for a future ADR when content surfaces it.

### Damage pipeline updates

**`physicalPaWp` reads weapon WP.** The handler resolves the attacker's "active weapon" via `getEquippedWeapon(unit)` — `rightHand` if it carries a weapon, else `leftHand`. Composes `PA × WP × power_coefficient × variance`. When no weapon is equipped (unarmed), `WP = 1`.

**`evasionCheck` reads weapon accuracy.** Per ADR-0014, weapon accuracy replaces the per-ability default. The handler reads `getEquippedWeapon(attacker).accuracy ?? 100`. The per-ability `hitRoll.accuracy` field stays as an override for content that wants to depart from weapon accuracy (Stasis Sword could, e.g., over-ride to 50 if we wanted; v1 doesn't).

**Weapon tag composition.** `physicalPaWp` (the gate handler) checks for the `'weapon'` tag on `ctx.damageTags`. When present, it merges `getEquippedWeapon(attacker).tags` into the running tag set on the ctx before computing baseDamage. The merge happens inside the base stage so downstream stages (resistance_check) see the complete tag set. Weapons without a `tags` field contribute nothing — the long_sword has `['sword']` only.

**Field rename.** `DamageSpec.power` → `DamageSpec.power_coefficient`. The field's meaning genuinely changes (before: combined WP × coefficient; after: just the coefficient), and the rename forces every existing physical-damage-bearing ability to acknowledge the new model. Magical / healing abilities also rename (their formula `MA × power × Faith_factor` → `MA × power_coefficient × Faith_factor`), keeping the name uniform across all base-stage handlers. This *supersedes* ADR-0014's no-rename clause: the cost is bounded (rename across ~8 abilities) and the clarity benefit is permanent.

### Status application formula updates

`StatusEffectSpec` gains two optional fields:

```ts
interface StatusEffectSpec {
  ...existing fields
  readonly applyAlways?: boolean;
  readonly factors?: { readonly faith?: boolean; readonly brave?: boolean; readonly ma?: boolean; readonly pa?: boolean };
}
```

When `applyAlways: true`, the formula is bypassed — the status applies unconditionally (the `modifyStatusApplicationChance` chain still runs in case a future hook wants to gate even applyAlways effects, but the post-modifier value is clamped between 0 and 1 only — there's no formula compute). The roll is recorded as `1.0` in the outcome for replay determinism.

When `factors` is omitted, the default is `{ faith: true, ma: true }` — preserves Earth Magic's existing behavior. Each `factors` field, when `true`, multiplies its corresponding factor into the chance:
- `faith: true` → `Faith_factor` (`(Faith_user/100) × (Faith_target/100)`)
- `brave: true` → `Brave_factor` (`(Brave_user/100) × (Brave_target/100)`)
- `ma: true` → `MA_factor` (`0.9 + MA/10`)
- `pa: true` → `PA_factor` (deferred — v1 throws `NotYetImplementedError` if set; first PA-based applier consumer ships the formula)

Resistance and `modifyStatusApplicationChance` modifiers continue to compose unconditionally — they're outside the factor-selection model. Earth Communion's `× 1.25` modifier still fires for Stasis Sword's Stop application; no new tag is needed to gate it.

### `modifyEvasion` hook (closed surface +1)

Class evasion is read inside `pickEvasion` in `engine/damage/handlers.ts`. To let Bulwark Stance modify it, a new hook fires inside `pickEvasion` against the *defender's* hooks:

```ts
modifyEvasion: {
  args: { unit: Unit; attacker: Unit; baseEvasion: number; facing: 'front' | 'side' | 'back' };
  return: number;
}
```

The handler returns the modified evasion value; the chain composes additively (concrete handler returns `baseValue + delta`). v1 first consumer is Bulwark Stance; future consumers (Concentration support reducing target evasion, Reverse Polarity reactions, etc.) reuse the surface. Adds one to the closed hook surface (11 → 12); per CLAUDE.md ground rule 8, this is a deliberate change with a content consumer to drive it.

### Source-KO status sweep

`StatusEffectType` gains an optional `removeOnSourceKO?: boolean`. Default `false` (preserves existing statuses). When `true`, after any reducer step that drops a unit's HP to 0 (the damage pipeline's `finalize` write), a sweep step scans all units' statuses for `source.unitId === KO'd_unit.id && type.removeOnSourceKO === true` and emits `status_remove` actions onto the action chain.

Mechanism lives in `resolveAbilityEffect`'s post-vital-application step. It doesn't add a new hook — the closed surface stays at 12 (with `modifyEvasion` already counted). Taunted is the only v1 consumer.

### Demo battle

The two demo Knights gain a `long_sword` in `rightHand` so the WP path is exercised. Damage numbers stay matched: the prior `attack` had `power: 4` (effective WP=4 at coefficient=1); the new attack uses `power_coefficient: 1.0` and reads WP=4 from the long_sword. Iron Helm / Iron Mail / Strength Ring / Boots of Haste ship as catalog content but are not equipped on demo units — keeps demo tuning unchanged so we don't conflate equipment integration with battle balance.

## Consequences

- **`AbilityDefinition` and every existing physical/magical/healing ability migrates `power` → `power_coefficient`.** ~8 callsites change. Pure rename; the Knight's `attack` ability also reduces `4` → `1.0` since WP is now sourced from the equipped long_sword.

- **The closed hook surface grows to 12.** `modifyEvasion` lands now; future evasion-modifying content (Concentration, etc.) reuses it.

- **`StatusEffectSpec.factors` and `applyAlways` are optional** — existing Earth Magic specs don't change. New abilities that want non-default factors declare them explicitly.

- **Equipment-sourced statuses are immune to in-battle removal.** Status-stripping abilities (none in v1) silently no-op against equipment sources. The check lives at `removeStatus`'s entry; `status_remove` system actions check the same predicate before reducing.

- **`UnitPlacement.vitals` becomes optional.** When omitted, current HP/MP fill to computed maxes. Existing placements that pass explicit `vitals` continue working.

- **`ItemDefinition` becomes the discriminated union over equipment slot kinds.** v1 has no consumables; when they ship, `kind: 'consumable'` joins the union without breaking equipment.

- **Equipment hook source plumbs through `collectActiveHandlers`.** The collector grows one branch (Equipment); all existing source branches (Class, Passive, Status) stay unchanged.

- **Renderer's `buildAnim` gains an `assertNever` exhaustiveness check** alongside the new `system_damage` action handling from 17b — small follow-up that eliminates the silent-fallthrough class of bug.

## Alternatives considered

**Discriminated union vs. flat shape for `EquipmentDefinition`.** Flat shape (`{ kind, wp?, accuracy?, ... }`) makes the type permissive — armor could carry WP. Rejected because the type-narrowing benefit is real: `getEquippedWeapon(unit)` returns `WeaponEquipment | null` rather than `EquipmentDefinition | null` with conditional wp/accuracy reads.

**`'status'` ability tag for Earth Communion gating.** Rejected because Earth Communion's `modifyStatusApplicationChance` already fires unconditionally on any status-applying ability; gating it to a tag would be a new constraint, not an enabling change. If a future ability wants to *opt out* of Earth Communion's modifier, the right shape is a per-modifier tag check, not a per-ability tag declaration.

**`onUnitKO` hook as the source-KO sweep mechanism.** Rejected because the consumer is purely about status lifecycle. A flag-on-status + reducer sweep is more focused than a hook with one v1 consumer that does one thing. When a content consumer needs broader unit-KO awareness (a "deathblow" reaction, a status that triggers when its bearer kills someone), the hook surfaces with a real call site.

**Per-ability formula function (instead of `factors` declaration).** Rejected because formulas need to be replay-deterministic and serializable for action-log reproduction. A declarative factor list is both, and it covers the v1 surface with one PA-formula extension to come.

**Auto-recompute max HP on equipment swap.** Rejected for v1 because there are no equipment swaps. When mid-battle equipment changes ship, the recompute-and-clamp policy (current HP retained but capped at new max? scaled proportionally?) gets its own ADR.

## References

- ADR-0014 (the no-rename clause this ADR supersedes).
- ADR-0027 (system actions for status side effects, the emission shape this ADR's source-KO sweep uses).
- ADR-0017 (the broader system-action infrastructure).
- `docs/battle-mechanics-guide.md` — Faith/Brave factors, status-application formula, weapon-accuracy default.
- `docs/design/ability-slots.md` — equipment slot rules.
- `src/engine/damage/handlers.ts` — `physicalPaWp`, `evasionCheck` (the WP and accuracy consumers).
- `src/engine/status/chance.ts` — the status-application formula being made customizable.
- `src/engine/setup/create-initial-state.ts` — battle-start HP/MP fill.
