// ItemDefinition — the catalog definition of an equippable (and
// eventually consumable) item.
//
// Per ADR-0028, v1's `ItemDefinition` is the equipment shape — a
// discriminated union over the four equipment slot kinds (weapon /
// armor / headgear / accessory). Consumables (potions, ethers, etc.)
// extend the union with `kind: 'consumable'` when they ship; the
// equipment-slot kinds stay an inner sum.
//
// The base shape is shared across all equipment kinds; weapons add WP
// and accuracy. Any kind can carry stat mods, status grants, and
// damage tags — armor that adds MA is valid, accessories that grant a
// status are valid (Boots of Haste). The discriminant exists for slot
// validation (weapons in hand slots, headgear in headgear slot, etc.)
// per `createInitialState`.

import type {
  AbilityId,
  BucketId,
  ClassId,
  DamageTag,
  ItemId,
  PartialBaseStats,
  StatName,
  StatusTag,
  StatusTypeId,
} from '../../types/index.ts';
import type { Availability } from './availability.ts';

// Per ADR-0056 (Session 27): equipment contributes to four additional
// hook surfaces via optional fields read by per-hook contributors in
// `engine/items/contributions.ts`. No v1 item declares them; Session 29
// onward will populate them on actual equipment (Staff of Power, Wand
// of Deepwood, Capacitor Ring, Pointy Hat, Focus Band, etc.).

// A single tag-conditional action-speed delta. `tagFilter` gates on the
// ability's damage tags (Wand of Deepwood applies only when the spell
// is Earth-tagged); omitted filter means "applies to all abilities."
export interface ActionSpeedModifier {
  readonly delta: number;
  readonly tagFilter?: ReadonlyArray<DamageTag>;
}

// Per-axis ability-range delta, optionally gated on the ability's damage
// tags. Wand of Depths authors `{ deltaHorizontal: 1, deltaVertical: 1,
// tagFilter: ['water'] }`. Composition is additive per axis. Per
// Session 29.
export interface AbilityRangeModifier {
  readonly deltaHorizontal?: number;
  readonly deltaVertical?: number;
  readonly tagFilter?: ReadonlyArray<DamageTag>;
}

// S51: additive delta on AoE vertical tolerance, optionally gated on the
// ability's damage tags. Battle Dictionary widens magical AoEs by +1
// elevation tolerance; the Wand of the Depths refit moves its dead
// `deltaVertical: 1` (spells already have vertical: 99 targeting) onto
// this surface so the bonus actually moves a value players can feel —
// elevation-rich AoE casts cover more tiles. Composition is additive.
export interface AoeVerticalToleranceModifier {
  readonly delta: number;
  readonly tagFilter?: ReadonlyArray<DamageTag>;
}

// Per-facing evasion delta. Steel Helm authors `{ side: -20, back: -20 }`.
// Composition is additive; negative deltas are valid (they produce
// hit-chance > weapon accuracy from the targeted facing, clamped at the
// damage pipeline's final [0.05, 1.0] hit-chance exit). Per Session 29.
export interface EvasionMods {
  readonly front?: number;
  readonly side?: number;
  readonly back?: number;
}

// Target-side incoming-status-application chance modifier. Either
// per-status-type (Pointy Hat: × 0.5 on Silence) or per-status-tag
// (Focus Band: × 0.75 on any negative-tagged status).
export type IncomingStatusModifier =
  | { readonly kind: 'by_type'; readonly statusTypeId: StatusTypeId; readonly chanceMultiplier: number }
  | { readonly kind: 'by_tag'; readonly statusTag: StatusTag; readonly chanceMultiplier: number };

// Status-tick-amount multiplier — applied multiplicatively to the
// per-tick decrement amount (default 1). Either per-status-type
// (`statusTypeId`) or per-status-tag (`statusTag`); both undefined
// means "applies to every status." Purifier authors `{ factor: 2,
// statusTag: 'negative' }`. Per ADR-0060.
export interface StatusTickAmountMultiplier {
  readonly factor: number;
  readonly statusTypeId?: StatusTypeId;
  readonly statusTag?: StatusTag;
}

// Session 45 follow-up (ADR-0084). Additive stack-count modifier for
// status applications driven by the wearer. Wand of Lumen authors
// `[{ delta: 1, statusTypeId: 'burn', sourceAbilityTagAll: ['fire'] }]`
// → every Burn application from a fire-tagged ability cast by a Lumen
// wielder lands with one extra stack. All declared gates must match
// (logical AND); omitted gates are wildcards. Composed by the source-
// side `modifyStatusApplicationStackCount` chain.
export interface StatusApplicationStackCountModifier {
  readonly delta: number;
  readonly statusTypeId?: StatusTypeId;
  readonly statusTag?: StatusTag;
  readonly sourceAbilityTagAll?: ReadonlyArray<string>;
}

// Per ADR-0064 (Session 30): weapon spell-cast rider. Each entry declares
// a probability and the ability to fire when the proc lands. Procs fire
// from `onDamageDealt` against the attacker's hooks, gated to physical-
// tagged hits that landed (no proc on misses, no proc on magical-only
// damage). The procced ability is fired against the original target,
// MP-free, and bypasses caster-status gates (Silence does not stop a
// weapon's proc — it's the weapon's power, not the wielder's). Bolt
// Hammer authors `[{ chance: 0.25, abilityId: 'lightning_basic' }]`;
// Flametongue authors `[{ chance: 0.25, abilityId: 'apply_burn' }]`.
export interface AttackProcDef {
  readonly chance: number;       // [0, 1]
  readonly abilityId: AbilityId;
}

// Common fields across every equipment kind. Stat mods, status grants,
// and damage tags all default to "none" when omitted; consumers pattern
// against the optional shape directly.
interface EquipmentBase {
  readonly id: ItemId;
  readonly name: string;
  // Required per ADR-0049. Catalog construction throws if missing.
  readonly availability: Availability;

  // Additive stat modifiers contributed by this item while equipped.
  // Each declared stat is read by a corresponding `modifyStatQuery`
  // handler emitted from the equipment hook source. Composition is
  // additive; multiplicative shifts use `statModsMultiplicative` below.
  readonly statMods?: PartialBaseStats;

  // Multiplicative stat modifiers — keyed by query StatName (not
  // BaseStats storage key) so authors write `{ maxMp: 1.5 }` for Staff
  // of Abundance. Each declared entry contributes one handler that
  // multiplies the running baseValue by the factor. Composition within
  // the Equipment tier runs *after* all additive handlers per
  // ADR-0058 — `(60 + 40) × 1.5 = 150` for a Mage in Wizard's Robe
  // (+40 MP additive) with Staff of Abundance (×1.5 multiplicative).
  // Per-handler tieBreakIndex within the multiplicative group orders
  // multiple multipliers stably; the final composition is associative
  // so order among multipliers doesn't matter mathematically.
  readonly statModsMultiplicative?: Partial<Record<StatName, number>>;

  // Statuses applied to the wearer at battle start. Anchored with
  // `StatusInstanceSource = { kind: 'equipment', equipmentId, ... }`
  // so they're immune to in-battle removal until the equipment itself
  // is removed. Per ADR-0028.
  readonly statusGrants?: ReadonlyArray<StatusTypeId>;

  // Damage tags carried by this item — composed into ability damage
  // tag sets when an ability declares the `'weapon'` tag (per
  // ADR-0028's "Weapon tag composition"). Non-weapon equipment can
  // declare tags too; v1 has no consumer for armor-tagged composition.
  readonly tags?: ReadonlyArray<DamageTag>;

  // Per ADR-0056 (Session 27) — four optional contribution surfaces
  // wired through `modifyMpCost`, `modifyActionSpeed`, `modifyResistance`,
  // and `modifyIncomingStatusApplicationChance`. No v1 item declares
  // them; Session 29 populates them on real content.

  // Multiplicative MP-cost factors (Staff of Power × 1.20). Each entry
  // contributes one handler; the chain multiplies them in source-tier
  // / priority order. Round half-up is applied by `computeMpCost`.
  readonly mpCostMultipliers?: ReadonlyArray<number>;

  // Additive action-speed deltas, optionally gated on the ability's
  // damage tags (Wand of Deepwood: +5 only on Earth-tagged casts).
  // Applied at commit time via `computeBaseActionSpeed`.
  readonly actionSpeedModifiers?: ReadonlyArray<ActionSpeedModifier>;

  // Per-tag resistance shifts (Capacitor Ring `{ lightning: +50 }`,
  // Wand of Depths `{ lightning: +50, fire: -50 }`). Each entry
  // contributes one handler; the chain composes additively per tag.
  readonly resistanceMods?: ReadonlyMap<DamageTag, number>;

  // Target-side multiplicative chance modifiers for incoming status
  // applications. By-type (Pointy Hat: Silence × 0.5) or by-tag
  // (Focus Band: any negative-tagged status × 0.75). One handler per
  // entry; the chain composes multiplicatively against the post-
  // caster-chain chance.
  readonly incomingStatusModifiers?: ReadonlyArray<IncomingStatusModifier>;

  // Per ADR-0059 (Session 28). Additive bucket-capacity deltas — e.g.
  // Steel Helm `{ reaction: 1 }`, Augmentor `{ support: 1 }`, Magus
  // Crown `{ first_action: 1 }`. Each entry contributes one handler
  // that returns `args.baseCapacity + delta` when `args.bucket`
  // matches the entry's key. No v1 item declares the field; Session 29
  // populates it on Steel Helm / Augmentor / Magus Crown.
  readonly bucketCapacityMods?: ReadonlyMap<BucketId, number>;

  // Per ADR-0060 (Session 28). Multiplicative status-tick-amount
  // modifiers — Purifier `[{ factor: 2, statusTag: 'negative' }]`
  // doubles the per-tick stack-consumption rate on Burn / Poison /
  // negative-tagged statuses. Each entry contributes one handler that
  // returns `args.baseAmount * factor` when the status's type / tags
  // match the gate; no-op otherwise.
  readonly statusTickAmountMultipliers?: ReadonlyArray<StatusTickAmountMultiplier>;

  // Session 45 follow-up (ADR-0084). Source-side additive stack-count
  // modifiers for status applications. Wand of Lumen: +1 stack on Burn
  // applied by fire-tagged abilities (per-application, single-shot — no
  // recursion). Composed via the `modifyStatusApplicationStackCount`
  // chain inside `applyStatus` before the type's composer reads the
  // stack count.
  readonly statusApplicationStackCountModifiers?: ReadonlyArray<StatusApplicationStackCountModifier>;

  // Session 29: optional class allowlist. When present, only units of
  // a listed class may equip the item — Knight-only shields, Mage-only
  // robes, etc. Validated at `createInitialState` time alongside the
  // existing slot-permission check on `ClassEquipmentSlots`. Omitting
  // the field means "any class permitted."
  readonly classRestrictions?: ReadonlyArray<ClassId>;

  // Session 29: ability-range modifiers — per-axis deltas gated on
  // ability tags. Wand of Depths' "+1 horizontal/+1 vertical on Water-
  // tagged spells" composes here. Read by `computeAbilityRange`.
  readonly abilityRangeModifiers?: ReadonlyArray<AbilityRangeModifier>;

  // S51: AoE vertical-tolerance modifiers — additive deltas, optionally
  // gated on ability tags. Battle Dictionary (book, mage off-hand) and the
  // Wand of the Depths refit (water-tagged) both consume this surface.
  // Composed through `modifyAoeVerticalTolerance` alongside Aether Bloom's
  // existing passive-side contribution.
  readonly aoeVerticalToleranceModifiers?: ReadonlyArray<AoeVerticalToleranceModifier>;

  // Session 29: caster-side outgoing hit-chance multipliers. Arcane Lens
  // authors `[1.10]`. Each entry contributes one handler that multiplies
  // the running hit chance; chain product composes after the existing
  // target-side `modifyHitChance` chain. Per Session 29.
  readonly outgoingHitChanceMultipliers?: ReadonlyArray<number>;

  // Session 29: per-facing evasion modifications on the wearer. Steel
  // Helm authors `{ side: -20, back: -20 }`. Composed through the
  // existing `modifyEvasion` additive chain at evasion-check time.
  readonly evasionMods?: EvasionMods;

  // Session 29: additive deltas on movement-class stats (moveRange,
  // jump). These don't live on BaseStats — they come from the unit's
  // class via `ClassMovementBaseline`. Lightfoot authors `{ moveRange:
  // 1, jump: 1 }`. Speed lives on BaseStats and rides `statMods`.
  // The contributor emits one `modifyStatQuery` handler per (stat,
  // delta) entry, gated on the query stat name.
  readonly movementMods?: Partial<Record<'moveRange' | 'jump', number>>;

  // ADR-0064 (Session 30): weapon spell-cast riders. Each entry is a
  // (chance, abilityId) pair fired when a physical hit lands. The proc
  // ability is MP-free and bypasses Silence (it's the weapon's power,
  // not the wielder's). Procs share chain-depth with reactions; they
  // do not count against the per-unit-per-turn reactor cap (reactor cap
  // is target-side; procs are attacker-side). No v1 item declares this
  // field; Session 31 ships Bolt Hammer + Flametongue Burn proc.
  readonly attackProcs?: ReadonlyArray<AttackProcDef>;

  // ADR-0080 (Session 42): swings-per-weapon multiplier for the basic
  // Attack command. When the wearer issues a basic Attack (not a reaction
  // or a Battle Skill), each eligible weapon swings this many times. The
  // Offering authors `2` (each weapon swings twice). Wired into the
  // `modifySwingsPerWeapon` hook via `swingsPerWeaponContributor`;
  // multiplies the eligible-weapon-slot list in `attackingWeaponSlots`.
  // Composes with Two Weapons (dual-wield adds the off-hand slot; this
  // doubles each slot) — both equipped → four swings.
  readonly attackSwingMultiplier?: number;

  // ADR-0065 (Session 30): damage-to-MP-drain percentage. When a
  // physical hit from this item's wearer lands (and isn't absorbed), the
  // wearer drains `floor(damageDealt × percent / 100)` MP from the
  // target via `system_mp_drain`. Drain is transfer-bounded by both
  // target's current MP (floor at 0) and source's headroom under maxMp.
  // Rasp Pendant authors `10` (Session 31). No v1 item declares this
  // field. The contributor wires it into the new `onFinalDamage` hook.
  readonly damageMpDrainPercent?: number;

  // Session 37: physical-reflect percentage. When the wearer takes a
  // physical hit that lands (and isn't absorbed), `floor(damageDealt ×
  // percent / 100)` damage is emitted back at the attacker as a
  // revenge-sourced `system_damage`. Spiked Mail authors `20`. Magical
  // damage doesn't trigger reflect (`damageTags.has('physical')` gate);
  // KO'd wearers don't reflect (the wearer is engagement-inactive);
  // absorbed hits (resistance > 100 tag-flip per ADR-0057) don't
  // reflect; the revenge emission itself bypasses the seven-stage
  // damage pipeline so it can't infinite-loop. The contributor wires
  // into the new `onFinalDamageReceived` hook.
  readonly physicalReflectPercent?: number;
}

// Weapon-sourced variance source (per ADR-0067 + Session 40 extension).
// Discriminated union so future variance formulae (e.g., "scales with
// remaining HP," "scales with stack count of a status") can land as
// additional `kind` arms without growing a parallel field. Resolution
// lives in `engine/damage/handlers.ts → resolveVarianceBand`.
//
//  - `kind: 'static'` — fixed [min, max] band per the original ADR-0067
//    shape. War Axe and Bolt Hammer use this (asymmetric [0.9, 1.3]).
//  - `kind: 'attacker_speed'` — dynamic band computed from the wielder's
//    post-equipment Speed (read through `modifyStatQuery` so Sai's +1
//    Speed and any future Speed-modifying contributors compose). Band
//    spans `[Speed/10 - spread, Speed/10 + spread]`. The knife weapon
//    class uses this with `spread: 0.05` so a Knight (Speed 9) wielding
//    a knife rolls in `[0.85, 0.95]`, a Lightning Mage (Speed 11) rolls
//    in `[1.05, 1.15]`, and a Sai-wielding Knight (Speed 10) rolls in
//    `[0.95, 1.05]`.
//  - `kind: 'height_delta'` — target-context variance (Session 45, bow
//    weapon class). Deterministic given positions: the band collapses to
//    a single point `Max(0, 1 - falloffPerHeight × (targetHeight -
//    attackerHeight))`. Shooting up reduces damage; shooting down boosts
//    it. The Longbow uses `falloffPerHeight: 0.2` → same height = 1.0,
//    4 above = 0.2, 5+ above = 0 (clamped), 5 below = 2.0. The only
//    variance arm that reads the target, not just the attacker.
//  - `kind: 'attacker_brave'` — dynamic band computed from the wielder's
//    Brave (Session 50, Knight Sword weapon class). Band spans
//    `[Brave/100 - spread, Brave/100 + spread]`. High-Brave wielders
//    push the average roll toward (and past) parity; low-Brave wielders
//    consistently under-roll. Absolom uses `spread: 0.05` so a Brave-70
//    wielder rolls in `[0.65, 0.75]`, a Brave-80 wielder in `[0.75,
//    0.85]`, and a Brave-100 wielder in `[0.95, 1.05]`.
export type WeaponPhysicalVariance =
  | { readonly kind: 'static'; readonly min: number; readonly max: number }
  | { readonly kind: 'attacker_speed'; readonly spread: number }
  | { readonly kind: 'attacker_brave'; readonly spread: number }
  | { readonly kind: 'height_delta'; readonly falloffPerHeight: number };

export interface WeaponEquipment extends EquipmentBase {
  readonly kind: 'weapon';
  // Weapon power — fed into the physical base stage formula
  // (`PA × WP × power_coefficient`) per ADR-0028. The first physical
  // damage handler reads this value when the action's attacker has a
  // weapon equipped; absent equipment defaults to WP=1 (unarmed).
  readonly wp: number;
  // Weapon accuracy on the [0, 100] scale. Read by `evasionCheck` when
  // the ability's `hitRoll.accuracy` is omitted; the per-ability
  // accuracy is the override path. Default for unarmed is 100 per the
  // Battle Mechanics Guide.
  readonly accuracy: number;
  // Session 31 (ADR-0067) + Session 40: weapon-sourced variance, optional.
  // When set, physical damage from this wielder uses the resolved band
  // on sub-stream 0 in place of the ability's `damageSpec.variance`. The
  // pipeline variance stage forks on the 'physical' damage tag; magical-
  // only damage from the same wielder always reads the ability's band.
  // See `WeaponPhysicalVariance` above for the discriminator semantics.
  readonly physicalVariance?: WeaponPhysicalVariance;
  // Session 45: two-handed weapons (the bow class) occupy both hands.
  // When `true`, equipment slotting rejects any item in the off-hand
  // (the other hand slot) — no shield, no second weapon — so a
  // dual-wielder (Two Weapons) collapses to a single swing because the
  // off-hand is necessarily empty. Absent → one-handed (existing
  // behavior).
  readonly twoHanded?: boolean;
  // Session 45: weapon-sourced attack range (the bow class). Bows are
  // the first ranged weapon; every prior weapon is melee and the
  // universal `attack` ability hardcodes `range.horizontal: 1`. When a
  // weapon declares `range`, `computeAbilityRange` forks to it for
  // weapon-tagged physical attacks (parallel to the `physicalVariance`
  // fork), so the universal Attack — and weapon-tagged Battle Skills
  // like Lightning Stab — inherit the weapon's reach. `min` is the
  // can't-fire-too-close floor (default 1 when omitted); `vertical`
  // overrides the ability's vertical band (bows shoot across elevation,
  // so a large value reads as "infinite"). Absent → ability-declared
  // range (existing melee behavior).
  readonly range?: {
    readonly min?: number;
    readonly max: number;
    readonly vertical?: number;
  };
}

// Session 29: shields occupy the left-hand slot but aren't weapons —
// they carry no WP/accuracy and don't feed the physical-damage base
// stage. Their value is in evasion mods, resistance shifts, and stat
// boosts. Knight-only via `classRestrictions` per the equipment doc.
export interface ShieldEquipment extends EquipmentBase {
  readonly kind: 'shield';
}

export interface ArmorEquipment extends EquipmentBase {
  readonly kind: 'armor';
}

export interface HeadgearEquipment extends EquipmentBase {
  readonly kind: 'headgear';
}

export interface AccessoryEquipment extends EquipmentBase {
  readonly kind: 'accessory';
}

// Equipment-only union — the inner sum across slot kinds. Exposed for
// callers that specifically want equipment (e.g., `getEquippedWeapon`'s
// return type narrowing).
export type EquipmentDefinition =
  | WeaponEquipment
  | ShieldEquipment
  | ArmorEquipment
  | HeadgearEquipment
  | AccessoryEquipment;

// Per-effect specs for a consumable (Session 39a). Discrete fields per
// effect kind rather than aliasing `AbilityEffects`: items have no
// Faith/MA scaling on heals (the coefficient × PA formula is fixed),
// no reactions, 100% accuracy, no Charging — they aren't abilities.
// Modeling them with their own spec keeps Compound + Throw Item out of
// the ability pipeline entirely.
//
// HP / MP restore amounts are computed as `caster.PA × coefficient`,
// capped at maxHp / maxMp at apply time. Heals tagged `'healing'` so
// future consumers (resistance to healing, e.g.) can hook the
// system_heal emission path; no current v1 consumer depends on this.
export interface ConsumableHpRestoreSpec {
  readonly coefficient: number;
}
export interface ConsumableMpRestoreSpec {
  readonly coefficient: number;
}

// Status-clear spec for Remedy (Session 39a). v1 supports one filter
// kind: `'debuff'` — clears every status whose `aiHints.polarity` is
// not `'buff'` (undefined defaults to debuff per the polarity
// convention; see `src/ui/status-polarity.ts`). KO isn't a status, so
// it's naturally untouched by this filter. Future filters can extend
// the discriminated union (`{ kind: 'by_tag', tag: '...' }` etc.)
// without breaking the existing item.
export type ConsumableStatusClearSpec = { readonly kind: 'debuff' };

export interface ConsumableEffects {
  // Restore HP on the target. Phoenix Down also sets `removeKO: true`,
  // so the heal applies after the revive (the heal sees the revived
  // unit's HP, not 0).
  readonly hpRestore?: ConsumableHpRestoreSpec;
  // Restore MP on the target. Ether is the v1 consumer.
  readonly mpRestore?: ConsumableMpRestoreSpec;
  // When true, revive a KO'd target (HP=0 → HP=1 baseline; `hpRestore`
  // then layers on top). No-op on non-KO'd targets. Reset turnsKOd to 0.
  readonly removeKO?: boolean;
  // Clear statuses from the target by polarity filter. Equipment-sourced
  // statuses (`source.kind === 'equipment'`) are immune per ADR-0028 and
  // are filtered out before clearing.
  readonly clearStatuses?: ConsumableStatusClearSpec;
}

// Session 39a: consumable items live in stockpiles, produced by
// Compound (one item per cast, MP-gated) and applied by Throw Item
// (one item per cast, target-anchored). `compoundMpCost` is the MP
// charged at the Compound site; consumable application itself is free.
// Items aren't equipment — they have no slot, no statMods, no
// statusGrants. The discriminator keeps them inside the existing
// `ItemDefinition` union so the catalog `ItemId` keyspace is shared
// (a future `Hi-Potion` lives next to `Potion` in `items()`).
export interface ConsumableDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly kind: 'consumable';
  readonly availability: Availability;
  // MP charged at the Compound site to produce one of this item.
  readonly compoundMpCost: number;
  // What the item does when thrown.
  readonly effects: ConsumableEffects;
}

// `ItemDefinition` v2 — the union over equipment and consumables. The
// discriminator (`kind`) narrows callers; v1 equipment paths still
// match against the slot-kind tags ('weapon'/'shield'/'armor'/etc.)
// and naturally exclude consumables.
export type ItemDefinition = EquipmentDefinition | ConsumableDefinition;
