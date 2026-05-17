// Public API of src/engine/items.

export {
  EMPTY_UNIT_EQUIPMENT,
  EQUIPMENT_SLOT_IDS,
  EquipmentSlotMismatchError,
  getEquippedWeapon,
  isConsumable,
  isEquipment,
  iterateEquippedItems,
  validateSlotItem,
} from './equipment.ts';
export { equipmentContributionsFor } from './contributions.ts';
