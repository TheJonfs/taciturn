// Public API of src/ai.
//
// Decision-making for non-player units. Pure functions that read engine
// state and produce action proposals. Adapters that wire these into the
// orchestrator's `Controller` interface live in `src/app/controllers/`
// to keep this layer engine-only (per
// docs/architecture/architecture-overview.md).

export { decideBasicAi, type BasicAiDecision } from './basic.ts';
export {
  projectExpectedDamage,
  projectDamageContext,
  type ProjectExpectedDamageArgs,
} from './projection.ts';
export {
  planAiDeployment,
  deployRoleFromWeaponType,
  type DeployableUnit,
  type DeployRole,
  type AiDeploymentResult,
} from './deployment.ts';
