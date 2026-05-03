// Public API of src/engine/damage.
// See docs/design/action-resolution.md ("Damage pipeline") and
// docs/architecture/architecture-overview.md.

export {
  clampMinMax,
  finalize,
  fireOnDamageDealt,
  fireOnDamageReceived,
  healingBase,
  physicalPaWp,
  varianceRoll,
} from './handlers.ts';
export { defaultDamageHandlers } from './default-handlers.ts';
export {
  runDamagePipeline,
  type RunDamagePipelineArgs,
} from './pipeline.ts';
export {
  type DamageHandler,
  type DamageHandlerRegistry,
  type PipelineEnv,
} from './registry.ts';
