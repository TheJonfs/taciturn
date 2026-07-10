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
import { swingResolvesAsHeal } from '../items/equipment.ts';
import { DEFAULT_SCENARIO_TIER } from '../types/index.ts';
import type {
  DamageContext,
  DamageStage,
  DamageTag,
  EquipmentSlotId,
  GameState,
  RulesetDefinition,
  Unit,
} from '../types/index.ts';
import type { DamageHandlerRegistry, PipelineEnv } from './registry.ts';

// Ordering of the stages — matches the design doc's enumeration.
// Kept here (rather than read off the ruleset) because the *order* is
// architectural; the ruleset chooses which handlers run *within* each
// stage but does not reorder the stages themselves.
//
// `postFinalize` (Session 30, ADR-0065) runs after `finalize` so handlers
// fire against the integer `damageDealt` — purely emission, no transform.
const STAGE_ORDER: ReadonlyArray<DamageStage> = [
  'base',
  'attacker',
  'target',
  'environment',
  'variance',
  'cap',
  'finalize',
  'postFinalize',
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
  // AoE cluster size for chain-damage scaling (ADR-0032). Single-target
  // callers omit (defaults to 1); AoE callers pass `affected.length`.
  readonly targetCount?: number;
  // Per-swing weapon scope (Session 42, multi-swing). Threaded onto the
  // DamageContext so the base handler and proc contributor scope to one
  // weapon slot. Omitted for single-weapon / pre-S42 callers.
  readonly attackingWeaponSlot?: EquipmentSlotId;
  // Session 49: additive bump applied to the ability's effective
  // `power_coefficient` for this cast. Set by `resolveMathSkillDispatch`
  // from the Mathematician hook's resolved value; omitted by every
  // other caller.
  readonly additionalPowerCoefficient?: number;
}

export function runDamagePipeline(args: RunDamagePipelineArgs): DamageContext {
  const ruleset = args.catalog.getRuleset(args.state.ruleset.id);
  const damageSpec = args.ability.effects.damage;
  if (damageSpec === undefined) {
    throw new Error(
      `runDamagePipeline: ability ${JSON.stringify(args.ability.id)} has no damage spec — caller should not invoke the pipeline for status-only abilities`,
    );
  }

  let tags: ReadonlySet<DamageTag> = new Set(damageSpec.tags);
  // TABA M3 (Healer's Staff): a weapon declaring `attackResolvesAsHeal`
  // flips its weapon strikes to healing at pipeline entry — 'physical'
  // out, 'healing' in. Downstream stages then do the right thing for
  // free: evasion skips (no 'physical'), resistance/crit skip
  // ('healing'), and healing_base computes MA × WP × coef × Faith. The
  // reducer's natively-healing determination reads the same predicate
  // (swingResolvesAsHeal) so the log reports a heal, not an absorption.
  if (
    tags.has('weapon') &&
    swingResolvesAsHeal(args.attacker, args.attackingWeaponSlot, args.catalog, damageSpec.tags)
  ) {
    const flipped = new Set(tags);
    flipped.delete('physical');
    flipped.add('healing');
    tags = flipped;
  }
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
    targetCount: args.targetCount ?? 1,
    // TABA Seam 1: carry the battle's opaque scenario scalar onto the context
    // so damage hooks (Lumen's fire ×, Chris's cover) can read it.
    scenarioTier: args.state.scenarioTier ?? DEFAULT_SCENARIO_TIER,
    // Expose the per-action seed so source-tier hook handlers (e.g.
    // `attackProcContributor`) can roll deterministically off the same
    // stream as pipeline-stage handlers. Per ADR-0064.
    actionSeed: args.seed,
    ...(args.attackingWeaponSlot !== undefined
      ? { attackingWeaponSlot: args.attackingWeaponSlot }
      : {}),
    ...(args.additionalPowerCoefficient !== undefined
      ? { additionalPowerCoefficient: args.additionalPowerCoefficient }
      : {}),
  };

  for (const stage of STAGE_ORDER) {
    ctx = runStage(stage, ctx, args, ruleset);
  }
  return ctx;
}

// TABA Seam 2 (cover): run a RAW injected amount through ONLY the target's
// mitigation, so a redirected soak lands on the bearer reduced by their own
// Protect / resistances / armor. Reuses the ruleset's real target/environment/
// cap/finalize handlers (so it tracks the pipeline, not a hand-rolled copy),
// but skips `evasion_check` (a soak isn't a dodgeable telegraphed attack) and
// `fire_on_damage_dealt` (the ATTACKER's onDamageDealt already fired on the
// original hit — Lumen's fire × must not re-multiply). Base/attacker/variance/
// postFinalize stages are excluded: the base is injected, and reactions/reflect
// are deferred (mitigation-only per the S84 cover ruling).
const MITIGATION_SKIP_REFS: ReadonlySet<string> = new Set([
  'evasion_check',
  'fire_on_damage_dealt',
]);
const MITIGATION_STAGES: ReadonlyArray<DamageStage> = ['target', 'environment', 'cap', 'finalize'];

export interface RunMitigationOnlyPipelineArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
  // The original ability — only its damage tags are read (for resistance /
  // Protect gating); its base formula is NOT re-run.
  readonly ability: ActiveAbilityDefinition;
  // The RAW amount to mitigate (already `raw × fraction` from the cover handler).
  readonly baseDamage: number;
  readonly sourceActionSeq: number;
  readonly seed: number;
  readonly registry: DamageHandlerRegistry;
}

export function runMitigationOnlyPipeline(args: RunMitigationOnlyPipelineArgs): DamageContext {
  const ruleset = args.catalog.getRuleset(args.state.ruleset.id);
  const damageSpec = args.ability.effects.damage;
  if (damageSpec === undefined) {
    throw new Error(
      `runMitigationOnlyPipeline: ability ${JSON.stringify(args.ability.id)} has no damage spec`,
    );
  }
  const tags: ReadonlySet<DamageTag> = new Set(damageSpec.tags);
  let ctx: DamageContext = {
    attacker: args.attacker,
    target: args.target,
    sourceActionSeq: args.sourceActionSeq,
    sourceAbilityId: args.ability.id,
    damageTags: tags,
    baseDamage: args.baseDamage,
    multipliers: [],
    additives: [],
    variance: { min: 1, max: 1 },
    hit: true,
    targetCount: 1,
    actionSeed: args.seed,
    scenarioTier: args.state.scenarioTier ?? DEFAULT_SCENARIO_TIER,
  };
  for (const stage of MITIGATION_STAGES) {
    const refs = (ruleset.damagePipeline.stages[stage] ?? []).filter(
      (r) => !MITIGATION_SKIP_REFS.has(r),
    );
    if (refs.length === 0) continue;
    const env: PipelineEnv = { state: args.state, catalog: args.catalog, seed: args.seed, stage };
    for (const ref of refs) {
      const handler = args.registry.get(ref);
      if (handler === undefined) {
        throw new Error(
          `runMitigationOnlyPipeline: unknown handler ref ${JSON.stringify(ref)} at stage ${JSON.stringify(stage)}`,
        );
      }
      ctx = handler(ctx, env);
    }
  }
  return ctx;
}

function runStage(
  stage: DamageStage,
  ctx: DamageContext,
  args: RunDamagePipelineArgs,
  ruleset: RulesetDefinition,
): DamageContext {
  // Stage may be absent in a custom ruleset that predates the stage's
  // introduction (e.g. test fixtures composed before `postFinalize`
  // landed in Session 30). Treat absence as an empty handler list —
  // identical to the explicit empty-array case below.
  const refs = ruleset.damagePipeline.stages[stage] ?? [];
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
