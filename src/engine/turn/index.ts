// Public API of src/engine/turn.
// See docs/design/turn-structure.md.

export { evaluateBattleOutcome } from './evaluate-battle-outcome.ts';
export {
  advanceToNextEvent,
  type ScheduledAction,
} from './scheduler.ts';
