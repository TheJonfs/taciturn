// Public API of src/engine/hooks.
// The source-agnostic core of the hook system: hook signatures, the
// active-handler collector, and chain runners. Source-specific
// registrations (status, passive, equipment, class) live in their
// respective subsystems.
// See ADR-0005 (typing pattern) and docs/design/status-effects.md.

export {
  DEFAULT_HOOK_PRIORITY,
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  type ActionAttemptResult,
  type HookHandler,
  type HookName,
  type HookSignatures,
  type HookSourceTier,
  type TurnSkipResult,
} from './hooks.ts';
export {
  collectActiveHandlers,
  type CollectedHandler,
  type SourceContribution,
} from './collector.ts';
export {
  runModifyActionSpeed,
  runModifyBucketCapacity,
  runModifyCanEnter,
  runModifyEvasion,
  runModifyHitChance,
  runModifyIncomingStatusApplicationChance,
  runModifyMpCost,
  runModifyResistance,
  runModifySpecialMovement,
  runModifyStatQuery,
  runModifyStatusApplicationChance,
  runModifyStatusTickAmount,
  runModifySystemDamage,
  runModifyTerrainCosts,
  runOnActionAttempted,
  runOnActionTargeted,
  runOnDamageDealt,
  runOnDamageReceived,
  runOnTurnEnd,
  runQueryTurnSkipped,
} from './runners.ts';
