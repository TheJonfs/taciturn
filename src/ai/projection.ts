// Stat-aware damage projection — tier 2 (session 20b) AI substrate.
//
// `projectExpectedDamage(state, catalog, attacker, ability, target)`
// returns the expected `finalDamage` value for a hypothetical cast,
// folding in PA/MA, weapon WP, Faith × Faith, resistance (per-tag
// signedMax), Vulnerable amplification (via the target's onDamageReceived
// chain), evasion (as expected hit_chance × full damage), variance
// (midpoint), and crit (E[crit_factor] = (1-p)·1 + p·crit_multiplier).
//
// Implementation strategy: reuse `runDamagePipeline` directly with a
// projection-mode `DamageHandlerRegistry` that swaps the three
// random-rolling handlers (`variance_roll`, `evasion_check`, `crit_roll`)
// for deterministic expected-value variants. Every other handler
// (physical/magical base, healing base, resistance, on-damage hooks,
// clamp, finalize) is reused unchanged — Vulnerable's multiplier,
// resistance composition, equipment WP/accuracy, and per-tag composition
// all flow through the same code paths the live engine runs at cast time.
//
// **Why "registry swap" rather than "sample-and-average":** the random
// handlers are the only stochastic stages, and each has a known
// closed-form expectation (variance midpoint, hit_chance × damage,
// E[crit_multiplier]). Swapping is exact, single-call, and stays in
// sync with handler changes by construction — any new deterministic
// handler shipping into the default registry composes for free; any
// new random handler needs an explicit projection variant added here
// (which is what we want — random behaviors *should* draw author
// attention to projection treatment).
//
// **Reactions are NOT projected.** Reactions live outside the damage
// pipeline (in `runOnActionTargeted`); the AI's `reactionPenalty`
// scoring layer handles them separately. Same for self-damage costs —
// `selfDamage` is dispatcher-emitted, not pipeline-driven.
//
// Per the session-20b ADR: drift risk is mitigated by a contract test
// (`projection.test.ts`) that asserts the projection equals the
// average of N live `runDamagePipeline` runs within a small tolerance
// for representative scenarios.

// Imports are routed through engine sub-barrels rather than the top-level
// `@engine/index.ts` to break a module cycle: the engine barrel exports
// `src/engine/forecast/`, whose `damage-range.ts` imports back from
// `src/ai/projection.ts`. Going through sub-barrels keeps this file off
// the cycle's spine so Vite's ESM loader doesn't redeclare anything.
import {
  defaultDamageHandlers,
  readCritChance,
  runDamagePipeline,
  type DamageContext,
  type DamageHandler,
  type DamageHandlerRegistry,
} from '@engine/damage/index.ts';
import { getEquippedWeapon } from '@engine/items/index.ts';
import {
  runModifyEvasion,
  runModifyHitChance,
  runModifyStatQuery,
} from '@engine/hooks/index.ts';
import type { ActiveAbilityDefinition, Catalog } from '@engine/catalog/index.ts';
import type {
  Direction,
  GameState,
  Position,
  Unit,
} from '@engine/types/index.ts';

// Variance projection: append the midpoint factor as a multiplier.
// Mirrors `varianceRoll`'s skip-when-flat behavior so an ability with
// `variance: { min: 1, max: 1 }` (the v1 default) contributes nothing.
const projectionVarianceRoll: DamageHandler = (ctx) => {
  if (ctx.variance.min === 1 && ctx.variance.max === 1) return ctx;
  const factor = (ctx.variance.min + ctx.variance.max) / 2;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'variance', factor }],
  };
};

// Evasion projection: compute the expected hit_chance and append it as
// a multiplier instead of rolling. Critically, we do NOT set `ctx.hit
// = false` — the downstream resistance / Vulnerable / crit handlers
// short-circuit on `!ctx.hit` and would zero out the projection. Leaving
// hit=true and folding hit_chance into the multiplier chain yields the
// right expected value: E[damage] = hit_chance × full_damage.
//
// Mirrors `evasionCheck`'s short-circuits exactly — if the live handler
// would skip (no hitRoll, magical-only, prior miss), so does this. Reads
// equipment accuracy + per-facing evasion + elevation + modifyHitChance
// chain identically.
const projectionEvasionCheck: DamageHandler = (ctx, env) => {
  if (!ctx.hit) return ctx;
  if (!ctx.damageTags.has('physical')) return ctx;
  const ability = env.catalog.getAbility(ctx.sourceAbilityId);
  if (ability.kind !== 'active') return ctx;
  const hitRoll = ability.hitRoll;
  if (hitRoll === undefined) return ctx;

  const weapon = getEquippedWeapon(ctx.attacker, env.catalog);
  const accuracyPct = hitRoll.accuracy ?? weapon?.accuracy ?? 100;
  const accuracy = accuracyPct / 100;

  const targetClass = env.catalog.getClass(ctx.target.classState.currentClass);
  const facing = computeAttackerFacing(ctx.attacker.position, ctx.target.position, ctx.target.facing);
  const baseEvasionPct = pickEvasion(targetClass.evasion, facing);
  const evasionPct = runModifyEvasion(env.state, env.catalog, {
    unit: ctx.target,
    attacker: ctx.attacker,
    baseEvasion: baseEvasionPct,
    facing,
  });
  const evasionFactor = 1 - evasionPct / 100;

  const elevationModifier = computeElevationModifier(env.state, ctx.attacker.position, ctx.target.position);

  const baseChance = accuracy * evasionFactor * elevationModifier;
  const modifiedChance = runModifyHitChance(env.state, env.catalog, {
    target: ctx.target,
    attacker: ctx.attacker,
    ability,
    baseHitChance: baseChance,
  });
  const hitChance = Math.max(0.05, Math.min(1.0, modifiedChance));

  if (hitChance >= 1) return ctx;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'evasion', factor: hitChance }],
  };
};

// Crit projection: E[crit_factor] = (1 - p) · 1 + p · crit_multiplier
// = 1 + p · (crit_multiplier - 1). Append as a multiplier.
//
// Short-circuits mirror `critRoll`: missed action (impossible in
// projection mode but defensive), healing tag, crit_chance ≤ 0. The
// [0, 100] clamp lives inside `readCritChance` per ADR-0042 so the live
// roll and this projection variant share one read site (per ADR-0034's
// spirit; the prior duplicate clamp at this line is gone).
const projectionCritRoll: DamageHandler = (ctx, env) => {
  if (!ctx.hit) return ctx;
  if (ctx.damageTags.has('healing')) return ctx;
  const crit_chance = readCritChance(env, ctx.attacker);
  if (crit_chance <= 0) return ctx;
  const crit_multiplier = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'crit_multiplier',
    baseValue: ctx.attacker.baseStats.crit_multiplier,
  });
  const p = crit_chance / 100;
  const expectedFactor = 1 + p * (crit_multiplier - 1);
  if (expectedFactor === 1) return ctx;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'crit', factor: expectedFactor }],
  };
};

// Projection registry — every handler from defaultDamageHandlers, with
// the three random-rolling refs overridden.
const projectionRegistry: DamageHandlerRegistry = (() => {
  const map = new Map<string, DamageHandler>(defaultDamageHandlers);
  map.set('variance_roll', projectionVarianceRoll);
  map.set('evasion_check', projectionEvasionCheck);
  map.set('crit_roll', projectionCritRoll);
  return map;
})();

export interface ProjectExpectedDamageArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
  readonly ability: ActiveAbilityDefinition;
  // AoE cluster size for chain-damage scaling. Default 1 (single-target).
  readonly targetCount?: number;
}

// Projected expected `finalDamage` for the cast. Always >= 0; healing
// is returned as a positive value (the caller distinguishes by tag).
// Returns 0 for abilities without a damage spec — a debuff-only Magnetic
// Mark or status applier projects no expected damage; the AI scores
// those abilities through other paths.
//
// **Absorption avoidance (per ADR-0057, Session 27).** When the damage
// pipeline tag-flips to healing because the target's resistance > 100,
// `ctx.finalDamage` is the absorbed *heal* amount with `'healing'`
// added to `ctx.damageTags`. Returning that as positive damage would
// trick the AI's offensive scoring into preferring high-resistance
// targets (healing the enemy looks like big damage). Detect the
// absorption regime — non-healing ability whose projection ends up
// healing-flagged — and return 0 so offensive scoring discards the
// target. Active absorption-exploitation (heal an ally by hitting them
// with their absorbed tag) is a deliberate non-goal for v1; passive
// avoidance is sufficient.
export function projectExpectedDamage(args: ProjectExpectedDamageArgs): number {
  const damage = args.ability.effects.damage;
  if (damage === undefined) return 0;
  const ctx = runDamagePipelineProjection(args);
  const isNativelyHealing = damage.tags.includes('healing');
  const projectionFlippedToHeal = !isNativelyHealing && ctx.damageTags.has('healing');
  if (projectionFlippedToHeal) return 0;
  return ctx.finalDamage ?? 0;
}

// Direct access to the full DamageContext when a caller wants more than
// finalDamage (e.g., tests asserting individual multipliers).
export function projectDamageContext(args: ProjectExpectedDamageArgs): DamageContext {
  return runDamagePipelineProjection(args);
}

function runDamagePipelineProjection(args: ProjectExpectedDamageArgs): DamageContext {
  return runDamagePipeline({
    state: args.state,
    catalog: args.catalog,
    attacker: args.attacker,
    target: args.target,
    ability: args.ability,
    sourceActionSeq: 0,
    // Seed is unused in projection mode (the random handlers are
    // replaced) but the pipeline requires it.
    seed: 0,
    registry: projectionRegistry,
    ...(args.targetCount !== undefined ? { targetCount: args.targetCount } : {}),
  });
}

// --- helpers (mirror src/engine/damage/handlers.ts internals) ---

function computeAttackerFacing(
  attacker: Position,
  target: Position,
  facing: Direction,
): 'front' | 'side' | 'back' {
  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  if (dx === 0 && dy === 0) return 'front';
  const mag = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / mag;
  const uy = dy / mag;
  let fx = 0;
  let fy = 0;
  switch (facing) {
    case 'N': fy = -1; break;
    case 'S': fy = 1; break;
    case 'E': fx = 1; break;
    case 'W': fx = -1; break;
  }
  const cos = ux * fx + uy * fy;
  const COS_45 = Math.SQRT1_2;
  if (cos >= COS_45) return 'front';
  if (cos <= -COS_45) return 'back';
  return 'side';
}

function pickEvasion(
  evasion: { readonly front: number; readonly side: number; readonly back: number },
  facing: 'front' | 'side' | 'back',
): number {
  if (facing === 'front') return evasion.front;
  if (facing === 'side') return evasion.side;
  return evasion.back;
}

function computeElevationModifier(
  state: GameState,
  attacker: Position,
  target: Position,
): number {
  const attackerTile = state.map.tiles.find(
    (t) => t.x === attacker.x && t.y === attacker.y && t.layer === attacker.layer,
  );
  const targetTile = state.map.tiles.find(
    (t) => t.x === target.x && t.y === target.y && t.layer === target.layer,
  );
  if (attackerTile === undefined || targetTile === undefined) return 1.0;
  if (attackerTile.elevation > targetTile.elevation) return 1.05;
  if (attackerTile.elevation < targetTile.elevation) return 0.95;
  return 1.0;
}
