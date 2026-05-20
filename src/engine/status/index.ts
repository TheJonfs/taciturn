// Public API of src/engine/status.
// See docs/design/status-effects.md and ADR-0005.
//
// Source-agnostic hook surface (HookSignatures, runners, collector) lives
// in engine/hooks/ as of session 5; status-specific bits live here.

export {
  statusHook,
  type StatusHookContext,
  type StatusHookRegistration,
} from './hooks.ts';
export { statusContributionsFor } from './contributions.ts';
export { fireOnApply, fireOnRemove } from './runners.ts';
export {
  applyStackingRule,
  type StackingDispatchOutcome,
  type StackingLifecycle,
} from './stacking.ts';
export { applyStatus, type ApplyStatusArgs, type ApplyStatusReturn } from './apply.ts';
export { removeStatus, type RemoveStatusArgs, type RemoveStatusReturn } from './remove.ts';
export { isInfiniteDuration } from './duration.ts';
export type { StatusApplicationResult } from './result.ts';
export {
  computeStatusChance,
  rollStatusChance,
  NotYetImplementedError,
  type StatusChanceArgs,
  type StatusChanceResult,
} from './chance.ts';
