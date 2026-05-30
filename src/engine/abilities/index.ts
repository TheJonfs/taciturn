// Public API of src/engine/abilities.
// See docs/design/ability-slots.md and ADR-0007.

export {
  ACTIVE_BUCKET_IDS,
  ALL_BUCKET_IDS,
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
  bucketKind,
  PASSIVE_BUCKET_IDS,
  type BucketKind,
} from './constants.ts';
export {
  passiveHook,
  type PassiveHookContext,
  type PassiveHookRegistration,
} from './hooks.ts';
export { passiveContributionsFor } from './contributions.ts';
export {
  compileReaction,
  compileReactionAbility,
  type ReactionAbilityFields,
  type ReactionEffect,
  type ReactionTargetSelector,
  type ReactionTriggerCondition,
  type ReactionTriggerHook,
} from './reaction-compiler.ts';
export { computeMpCost, getCommandSetCost, getCost } from './cost.ts';
export { computeAbilityRange, type AbilityRangeView } from './range.ts';
export {
  weaponRangeFromHeightSpec,
  rangeFromHeightBonus,
  maxRangeFromHeightBonus,
  type RangeFromHeightBonus,
} from './range-height.ts';
export { getCapacity } from './capacity.ts';
export {
  validateLoadout,
  type LoadoutValidation,
  type LoadoutViolation,
} from './validate.ts';
export {
  equipPassive,
  setActiveBucket,
  unequipPassive,
  type EquipResult,
  type EquipResultFail,
  type EquipResultOk,
} from './equip.ts';
export { resolveWorldcraftCast, type WorldcraftCast } from './worldcraft-resolution.ts';
