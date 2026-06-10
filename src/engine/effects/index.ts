// Public surface of the Worldcraft effect-queue subsystem (Session 53,
// ADR-0088). The AI tier reads the effect cap to reason about revert-traps
// (S59 Tier C, ADR-0096) the same way the engine does — no drift.
export {
  DEFAULT_WORLDCRAFT_EFFECT_CAP,
  computeWorldcraftEffectCap,
  enqueueWorldcraftEffect,
  decrementBarrierTtls,
  revertActionsFor,
  type EnqueueResult,
  type BarrierTickResult,
} from './queue.ts';
