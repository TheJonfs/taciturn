// TABA M2 progression — public API of the JP economy subsystem.
//
// The durable state (`jpLedger`, `unlocks`, `classAccessOverride`) lives on
// `CampaignUnit` (../types.ts); everything here is the static tables, the
// derived selectors, and the pure operations over that state.

export type { UnlockToken, UnlockTokenKind } from './tokens.ts';
export { tokenKey, tokensEqual, hasToken, abilityToken } from './tokens.ts';

export type { ClassHalf, ClassTier, ClassTierEntry, TierSlot } from './tier-map.ts';
export {
  CLASS_TIER_MAP,
  tierSlot,
  slotOf,
  tierEntryOf,
  classesInSlot,
} from './tier-map.ts';

export {
  TIER2_FROM_TIER1_SPEND,
  OTHER_HALF_TIER1_FROM_TIER1_SPEND,
  TIER3_TIER1_SPEND,
  TIER3_TIER2_SPEND,
  HYBRID_T2_EACH_HALF_TIER1_SPEND,
  HYBRID_T3_FROM_HYBRID_T2_SPEND,
} from './thresholds.ts';

export type { ComponentMeta, ComponentCatalog } from './component-catalog.ts';
export { buildComponentCatalog, componentMetaOf } from './component-catalog.ts';
export { COMPONENT_CATALOG, COMPONENT_ENTRIES } from './component-catalog-data.ts';

export {
  earnedInClass,
  spentInClass,
  availableInClass,
  spentByTierSlot,
  unlockedTiers,
  reclassableClasses,
} from './ledger.ts';

export type { EquipGate } from './unlock.ts';
export {
  unlockComponent,
  grantJp,
  grantOnClassUnlock,
  tierGrantAmount,
  canEquipPassive,
  GRANT_BASE_PER_TIER,
  GRANT_RANDOM_RANGE,
} from './unlock.ts';

export {
  usableActiveIds,
  usableItemIds,
  usableMathParameterIds,
  usableMathValueIds,
} from './usable-actives.ts';

export {
  computeEarnedJp,
  defaultConnectingPredicate,
  defaultJpBase,
  SPILLOVER_FRACTION,
} from './earning.ts';
export type { ConnectingActionPredicate, EarnOptions, JpBaseFn } from './earning.ts';
