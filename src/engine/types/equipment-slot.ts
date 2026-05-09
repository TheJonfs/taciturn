// Equipment slot identifiers and the per-unit equipment map.
// See ADR-0028 ("Equipment integration") and docs/design/ability-slots.md
// (slot conventions inherited from FFT-style hand / armor / accessory).
//
// Five slots: leftHand / rightHand / headgear / armor / accessory.
// Weapons (and eventually shields) occupy hand slots; the slot pair
// (left, right) accommodates two-weapons / two-shields / weapon+shield
// future content. Headgear / armor / accessory each take a single item
// of their respective kind. v1 has no two-handed-only restriction;
// validation lives at `createInitialState` per ADR-0028.

import type { ItemId } from './ids.ts';

// Closed enumeration of slot ids. New slots (e.g., a future "boots"
// for additional movement-flavored content) require an explicit
// extension here plus a migration of `UnitEquipment` callsites.
export type EquipmentSlotId =
  | 'leftHand'
  | 'rightHand'
  | 'headgear'
  | 'armor'
  | 'accessory';

// Stable iteration order — used by the hook-source collector and the
// equipment helpers that walk all slots. Lexical ordering would be
// arbitrary; this order matches the ADR's "left/right then top-down"
// reading.
export const EQUIPMENT_SLOT_IDS: ReadonlyArray<EquipmentSlotId> = [
  'leftHand',
  'rightHand',
  'headgear',
  'armor',
  'accessory',
];

// The per-unit equipment map. Each slot holds at most one item id (or
// null if the slot is empty). v1 has no mid-battle equipment changes —
// the map is set at `createInitialState` and treated as immutable
// thereafter. Mid-battle theft / equipment-break needs an ADR when
// content surfaces it.
export interface UnitEquipment {
  readonly leftHand: ItemId | null;
  readonly rightHand: ItemId | null;
  readonly headgear: ItemId | null;
  readonly armor: ItemId | null;
  readonly accessory: ItemId | null;
}

// Convenience: an empty equipment map (all slots null). Used by tests
// and by `placementToUnit` when a placement omits equipment entirely.
export const EMPTY_UNIT_EQUIPMENT: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};
