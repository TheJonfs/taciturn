// Damage pipeline orchestrator — runs the seven-stage flow described
// in docs/design/action-resolution.md ("Damage pipeline").
//
// Stages execute in fixed order:
//   base → attacker → target → environment → variance → cap → finalize
//
// At each stage, the orchestrator looks up the handler refs in the
// active ruleset's `damagePipeline.stages[stage]`, resolves them via
// the supplied registry, and runs them in order. Handlers thread the
// `DamageContext` through; the next stage receives the previous stage's
// output.
//
// The pipeline is pure: same (state, action, ability, target, seed,
// ruleset, registry) yields the same DamageContext. State is read-only
// here — final damage application (writing to vitals) is the reducer's
// job, after this returns.

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type {
  DamageContext,
  DamageStage,
  DamageTag,
  GameState,
  RulesetDefinition,
  Unit,
} from '../types/index.ts';
import type { DamageHandlerRegistry, PipelineEnv } from './registry.ts';

// Ordering of the seven stages — matches the design doc's enumeration.
// Kept here (rather than read off the ruleset) because the *order* is
// architectural; the ruleset chooses which handlers run *within* each
// stage but does not reorder the stages themselves.
const STAGE_ORDER: ReadonlyArray<DamageStage> = [
  'base',
  'attacker',
  'target',
  'environment',
  'variance',
  'cap',
  'finalize',
];

export interface RunDamagePipelineArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
  readonly ability: ActiveAbilityDefinition;
  readonly sourceActionSeq: number;
  readonly seed: number;
  readonly registry: DamageHandlerRegistry;
}

export function runDamagePipeline(args: RunDamagePipelineArgs): DamageContext {
  const ruleset = args.catalog.getRuleset(args.state.ruleset.id);
  const damageSpec = args.ability.effects.damage;
  if (damageSpec === undefined) {
    throw new Error(
      `runDamagePipeline: ability ${JSON.stringify(args.ability.id)} has no damage spec — caller should not invoke the pipeline for status-only abilities`,
    );
  }

  const tags: ReadonlySet<DamageTag> = new Set(damageSpec.tags);
  const variance = damageSpec.variance ?? { min: 1, max: 1 };

  let ctx: DamageContext = {
    attacker: args.attacker,
    target: args.target,
    sourceActionSeq: args.sourceActionSeq,
    sourceAbilityId: args.ability.id,
    damageTags: tags,
    baseDamage: 0,
    multipliers: [],
    additives: [],
    variance,
    hit: true,
  };

  for (const stage of STAGE_ORDER) {
    ctx = runStage(stage, ctx, args, ruleset);
  }
  return ctx;
}

function runStage(
  stage: DamageStage,
  ctx: DamageContext,
  args: RunDamagePipelineArgs,
  ruleset: RulesetDefinition,
): DamageContext {
  const refs = ruleset.damagePipeline.stages[stage];
  if (refs.length === 0) return ctx;
  const env: PipelineEnv = {
    state: args.state,
    catalog: args.catalog,
    seed: args.seed,
    stage,
  };
  let next = ctx;
  for (const ref of refs) {
    const handler = args.registry.get(ref);
    if (handler === undefined) {
      throw new Error(
        `runDamagePipeline: unknown handler ref ${JSON.stringify(ref)} at stage ${JSON.stringify(stage)}`,
      );
    }
    next = handler(next, env);
  }
  return next;
}
