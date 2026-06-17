// Equipment helpers — read the unit's equipment map and return typed
// views for the damage pipeline / contribution collector.
// See ADR-0028.
//
// Identity-by-id: helpers take a Unit and a Catalog rather than caching
// equipment definitions on the Unit itself. The dereference is one
// catalog lookup per call site — small enough that it's not worth the
// caching complexity, and the catalog is the single source of truth
// for equipment definitions per CLAUDE.md ground rule 4.

import type { Catalog } from '../catalog/index.ts';
import type {
  ConsumableDefinition,
  EquipmentDefinition,
  ItemDefinition,
  WeaponEquipment,
} from '../catalog/index.ts';
import type {
  EquipmentSlotId,
  ItemId,
  Unit,
  UnitEquipment,
} from '../types/index.ts';
import { EQUIPMENT_SLOT_IDS } from '../types/index.ts';

// Resolve the unit's "active weapon" — what physical attacks read for
// WP and accuracy. Convention (FFT-canonical): right hand is the
// dominant weapon; left hand is consulted only when the right hand is
// empty (or holds a non-weapon — shields ship later). Returns the
// typed weapon or null when no weapon is equipped.
export function getEquippedWeapon(unit: Unit, catalog: Catalog): WeaponEquipment | null {
  const right = readSlotAsWeapon(unit.equipment.rightHand, catalog);
  if (right !== null) return right;
  return readSlotAsWeapon(unit.equipment.leftHand, catalog);
}

function readSlotAsWeapon(itemId: ItemId | null, catalog: Catalog): WeaponEquipment | null {
  if (itemId === null) return null;
  const item = catalog.getItem(itemId);
  if (item.kind === 'weapon') return item;
  return null;
}

// Resolve the weapon in a specific hand slot (Session 42, multi-swing).
// The damage pipeline passes the swinging slot so each swing reads its
// own weapon's WP / tags. Returns null when the slot is empty or holds
// a non-weapon (e.g. a shield). Only hand slots can hold weapons; a
// non-hand slot always returns null.
export function getWeaponInSlot(
  unit: Unit,
  slot: EquipmentSlotId,
  catalog: Catalog,
): WeaponEquipment | null {
  if (slot !== 'leftHand' && slot !== 'rightHand') return null;
  return readSlotAsWeapon(unit.equipment[slot], catalog);
}

// Resolve the weapon a given swing reads (S68 per-swing-consistency fix).
// When `attackingWeaponSlot` is set (a designated swing of a multi-swing
// dual-wield Attack), read that exact slot's weapon; otherwise resolve
// the dominant (right-hand) weapon. Every per-swing damage-pipeline read
// — WP (`physicalPaWp`), accuracy (`evasionCheck`), variance band
// (`resolvePhysicalVarianceBand`) — must route through this so a swing
// is internally consistent. Pre-S68, WP was per-slot but accuracy and
// variance read the dominant weapon, letting a dual-wielder launder the
// off-hand weapon's WP through the right-hand weapon's accuracy/variance
// (e.g. right-hand Sai's 95% + Speed-variance applied to a left-hand
// War Axe's WP 12). See ADR for the fix.
export function getSwingWeapon(
  unit: Unit,
  attackingWeaponSlot: EquipmentSlotId | undefined,
  catalog: Catalog,
): WeaponEquipment | null {
  return attackingWeaponSlot !== undefined
    ? getWeaponInSlot(unit, attackingWeaponSlot, catalog)
    : getEquippedWeapon(unit, catalog);
}

// Session 39a: predicates to narrow the widened `ItemDefinition` union
// (equipment + consumables). Equipment paths use `isEquipment` to filter
// before reading equipment-only fields like `bucketCapacityMods` or
// `classRestrictions`. Consumables never appear in equipment slots
// (rejected at `validateSlotItem`), so `iterateEquippedItems` filters
// defensively and narrows the yield type back to `EquipmentDefinition`.
export function isEquipment(item: ItemDefinition): item is EquipmentDefinition {
  return item.kind !== 'consumable';
}
export function isConsumable(item: ItemDefinition): item is ConsumableDefinition {
  return item.kind === 'consumable';
}

// Walk every non-empty slot on the unit's equipment, yielding (slotId,
// itemDefinition) pairs in the canonical slot order. Used by the
// equipment hook-source contributor to enumerate the unit's items
// without each caller redoing the slot iteration.
export function* iterateEquippedItems(
  unit: Unit,
  catalog: Catalog,
): Generator<{ readonly slot: EquipmentSlotId; readonly item: EquipmentDefinition }> {
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const id = unit.equipment[slot];
    if (id === null) continue;
    const item = catalog.getItem(id);
    // Session 39a: ItemDefinition now spans equipment + consumables;
    // equipment slots only hold equipment (enforced by validateSlotItem)
    // so this filter is defensive — narrows the yield type while
    // skipping a consumable id that somehow landed in a slot.
    if (!isEquipment(item)) continue;
    yield { slot, item };
  }
}

// Validate that a single equipment placement is legal: the slot exists
// on the class, the slot is permitted for this class, and the item's
// kind matches the slot expected. Used by `createInitialState` to
// catch authoring errors before the battle starts. Throws the slot's
// invalid pairing as a string so the caller can surface the message
// alongside the unit id.
export class EquipmentSlotMismatchError extends Error {
  override readonly name = 'EquipmentSlotMismatchError';
}

export function validateSlotItem(
  slot: EquipmentSlotId,
  item: ItemDefinition,
): void {
  // Session 39a: consumables never live in equipment slots — reject
  // explicitly before falling through to the equipment-kind checks.
  if (item.kind === 'consumable') {
    throw new EquipmentSlotMismatchError(
      `Slot ${slot} expects equipment, received a consumable item`,
    );
  }
  // Hand slots accept weapons or shields. Other slots require their
  // kind exactly. Per Session 29: shields became a real kind (vs the
  // pre-Session-29 placeholder comment) so Knight-only shield content
  // can ship.
  if (slot === 'leftHand' || slot === 'rightHand') {
    if (item.kind !== 'weapon' && item.kind !== 'shield') {
      throw new EquipmentSlotMismatchError(
        `Slot ${slot} expects a weapon or shield, received ${item.kind}`,
      );
    }
    return;
  }
  if (slot === 'headgear' && item.kind !== 'headgear') {
    throw new EquipmentSlotMismatchError(
      `Slot headgear expects a headgear item, received ${item.kind}`,
    );
  }
  if (slot === 'armor' && item.kind !== 'armor') {
    throw new EquipmentSlotMismatchError(
      `Slot armor expects an armor item, received ${item.kind}`,
    );
  }
  if (slot === 'accessory' && item.kind !== 'accessory') {
    throw new EquipmentSlotMismatchError(
      `Slot accessory expects an accessory item, received ${item.kind}`,
    );
  }
}

// Convenience: an empty UnitEquipment, used by `placementToUnit` when
// a placement omits equipment entirely.
export { EMPTY_UNIT_EQUIPMENT } from '../types/index.ts';

// Re-export the slot-ids constant for callers that import from
// `engine/items/` rather than `engine/types/`.
export { EQUIPMENT_SLOT_IDS };
export type { UnitEquipment };
