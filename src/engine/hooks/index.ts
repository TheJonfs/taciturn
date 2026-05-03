// Public API of src/engine/hooks.
// The source-agnostic core of the hook system: hook signatures, the
// active-handler collector, and chain runners. Source-specific
// registrations (status, passive, equipment, class) live in their
// respective subsystems.
// See ADR-0005 (typing pattern) and docs/design/status-effects.md.

export {
  DEFAULT_HOOK_PRIORITY,
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  type HookHandler,
  type HookName,
  type HookSignatures,
  type HookSourceTier,
} from './hooks.ts';
export {
  collectActiveHandlers,
  type CollectedHandler,
  type SourceContribution,
} from './collector.ts';
export {
  runModifyCanEnter,
  runModifySpecialMovement,
  runModifyStatQuery,
  runModifyTerrainCosts,
} from './runners.ts';
