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
  StatusTypeId,
} from '../../types/index.ts';

// Common fields across every equipment kind. Stat mods, status grants,
// and damage tags all default to "none" when omitted; consumers pattern
// against the optional shape directly.
interface EquipmentBase {
  readonly id: ItemId;
  readonly name: string;

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
