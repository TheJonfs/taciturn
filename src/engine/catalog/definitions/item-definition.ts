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
  DamageTag,
  ItemId,
  PartialBaseStats,
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

// Target-side incoming-status-application chance modifier. Either
// per-status-type (Pointy Hat: × 0.5 on Silence) or per-status-tag
// (Focus Band: × 0.75 on any negative-tagged status).
export type IncomingStatusModifier =
  | { readonly kind: 'by_type'; readonly statusTypeId: StatusTypeId; readonly chanceMultiplier: number }
  | { readonly kind: 'by_tag'; readonly statusTag: StatusTag; readonly chanceMultiplier: number };

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
  // additive; equipment never multiplies base stats today (statuses /
  // passives use multiplicative composition for that — keeps equipment
  // and status modifier semantics distinct).
  readonly statMods?: PartialBaseStats;

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
}

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
  | ArmorEquipment
  | HeadgearEquipment
  | AccessoryEquipment;

// `ItemDefinition` is `EquipmentDefinition` for v1. Consumables join
// the union under `kind: 'consumable'` when they ship.
export type ItemDefinition = EquipmentDefinition;
