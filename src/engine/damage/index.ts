// Public API of src/engine/damage.
// See docs/design/action-resolution.md ("Damage pipeline") and
// docs/architecture/architecture-overview.md.

export {
  clampMinMax,
  computeFaithFactor,
  evasionCheck,
  finalize,
  fireOnDamageDealt,
  fireOnDamageReceived,
  healingBase,
  magicalMaPower,
  physicalPaWp,
  readCritChance,
  resistanceCheck,
  resolvePhysicalVarianceBand,
  varianceRoll,
} from './handlers.ts';
export { defaultDamageHandlers } from './default-handlers.ts';
export { computeBarrierDamage } from './barrier-damage.ts';
export { computeOutgoingHitChance, type ComputeHitChanceArgs } from './hit-chance.ts';
export {
  runDamagePipeline,
  type RunDamagePipelineArgs,
} from './pipeline.ts';
export {
  type DamageHandler,
  type DamageHandlerRegistry,
  type PipelineEnv,
} from './registry.ts';
export type { DamageContext } from '../types/damage.ts';
