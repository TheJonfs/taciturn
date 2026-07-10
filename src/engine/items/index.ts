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
export {
  classCanEquip,
  draftAbilityCost,
  draftBucketCapacity,
  draftBucketUsed,
  draftCommandSetCost,
  findEquipLegalityConflicts,
  findTwoHandedConflictHands,
  loadoutGrantsDualWield,
  loadoutGrantsTwoHandedGrip,
  slotAcceptsKind,
  slotIneligibilityReason,
  validateDraftUnit,
  type DraftBucketOverage,
  type DraftEquipLegalityConflict,
  type DraftInvalidSlot,
  type DraftInvalidSlotReason,
  type DraftUnitLegality,
  type DraftUnitView,
} from './draft-legality.ts';
