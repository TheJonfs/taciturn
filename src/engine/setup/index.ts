// Public API of src/engine/setup.
// Battle setup — turning configuration into the immutable starting
// GameState that the reducer reads from at sequence number 0.

export { BattleConfigError, createInitialState } from './create-initial-state.ts';
