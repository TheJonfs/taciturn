// Public API of src/engine/actions.
// Action lifecycle: propose → validate → seed → pre-hooks → reduce →
// commit → process-chain. See docs/design/action-resolution.md and
// ADR-0009.

export {
  commitAction,
  type CommitFailure,
  type CommitResult,
  type CommitSuccess,
} from './commit.ts';
export { reduce, type ReducerOutput } from './reduce.ts';
export {
  reduceChargedActionResolve,
  reduceMove,
  reduceSetFacing,
  reduceStatusTick,
  reduceTurnEnd,
  reduceTurnStart,
  reduceUseAbility,
  reduceWait,
  type ReduceResult,
} from './reducers.ts';
export { deriveActionSeed } from './seed.ts';
export {
  expectActiveAbility,
  validateAction,
  type ValidationResult,
} from './validate.ts';
