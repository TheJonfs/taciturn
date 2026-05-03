// Public API of src/engine/status.
// See docs/design/status-effects.md and ADR-0005.

export {
  HOOK_SOURCE_TIER_ORDER,
  statusHook,
  type HookName,
  type HookSignatures,
  type HookSourceTier,
  type StatusHookContext,
  type StatusHookRegistration,
} from './hooks.ts';
export { collectActiveHandlers, type CollectedHandler } from './collector.ts';
export { fireOnApply, fireOnRemove, runModifyStatQuery } from './runners.ts';
export {
  applyStackingRule,
  type StackingDispatchOutcome,
  type StackingLifecycle,
} from './stacking.ts';
export { applyStatus, type ApplyStatusArgs, type ApplyStatusReturn } from './apply.ts';
export { removeStatus, type RemoveStatusArgs, type RemoveStatusReturn } from './remove.ts';
export type { StatusApplicationResult } from './result.ts';
