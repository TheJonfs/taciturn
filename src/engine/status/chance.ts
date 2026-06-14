// Status application chance formula — BMG "Status application chance"
// with per-ability factor selection (per ADR-0028):
//
//   hit_chance = base_chance × ∏selected_factors
//              × (1 - target_resistance / 100) × ∏modifiers
//
// where `selected_factors` is determined by the per-effect
// `StatusFormulaFactors` (default `{ faith: true, ma: true }`):
//   - Faith_factor = (Faith_user/100) × (Faith_target/100)
//   - Brave_factor = (Brave_user/100) × (Brave_target/100)
//   - MA_factor    = 0.9 + MA_caster / 10
//   - Speed_factor = 0.9 + Speed_caster / 20  (caster-only; Session 42)
//   - PA_factor    = 0.9 + PA_caster / 10  (caster-only; S65, ADR-0108 —
//                    first PA-using consumer is the Knight's Bull Rush
//                    knockback; mirrors MA_factor's shape)
//
// Resistance and `modifyStatusApplicationChance` modifiers compose
// unconditionally — they're outside the factor-selection model and
// fire even when `applyAlways` is set (so future hooks can gate even
// applyAlways effects if a content consumer wants).
//
// `applyAlways: true` short-circuits the factor / resistance / base
// chance compute — the status applies unconditionally. The recorded
// `chance` is 1.0 for replay determinism, the modifier chain still
// runs against the constant 1.0.

import type { ActiveAbilityDefinition, Catalog, StatusEffectType } from '../catalog/index.ts';
import {
  runModifyIncomingStatusApplicationChance,
  runModifyResistance,
  runModifyStatQuery,
  runModifyStatusApplicationChance,
} from '../hooks/runners.ts';
import type { GameState, Unit } from '../types/index.ts';
import type { StatusFormulaFactors } from '../catalog/definitions/ability-definition.ts';
import { computeBraveFactor, computeFaithFactor, computeSpeedFactor } from '../damage/handlers.ts';

// Sub-stream constant for the status-chance roll. Distinct from
// variance (0), evasion (1), and the brave reaction roll (2). Keeps
// each random subsystem on its own stream so a change in one doesn't
// shift the others.
const STATUS_CHANCE_SUB_STREAM = 3;

// Sub-stream base for ability-level chance rolls (per session 18) —
// knockback chance gates on damage riders and free-standing CT effects
// share this base. Sized to leave room for the status sub-stream to
// grow (an ability with up to ~12 status effects in a single use stays
// safely below 16). Adding a new chance subsystem picks the next gap.
const ABILITY_CHANCE_SUB_STREAM = 16;

export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

// Default factor selection when the StatusEffectSpec omits `factors`.
// Preserves Earth Magic's existing `Faith_factor × MA_factor` behavior
// (per ADR-0028). New abilities that want a different shape declare
// `factors` explicitly.
const DEFAULT_FACTORS: Readonly<Required<StatusFormulaFactors>> = {
  faith: true,
  brave: false,
  ma: true,
  pa: false,
  speed: false,
};

export interface StatusChanceArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly target: Unit;
  readonly statusType: StatusEffectType;
  // null when the application is not driven by an ability (e.g., a
  // status applied by an environmental effect or a system action). The
  // hook still fires; the `ability` arg lets handlers gate on tags,
  // but the absence is honest.
  readonly ability: ActiveAbilityDefinition | null;
  readonly baseChance: number; // [0, 100]
  readonly seed: number;
  // When an ability declares multiple status effects, each effect
  // rolls independently. The caller passes its 0-indexed position;
  // the roll mixes the index into the seed so Earth Curse (Blind +
  // Silence, two effects) doesn't end up with both effects tied to
  // the same coin flip. Defaults to 0 for the single-effect case.
  readonly effectIndex?: number;
  // Per-effect factor selection (per ADR-0028). When omitted, the
  // default is `{ faith: true, ma: true }` (Earth's canonical shape).
  // Stasis Sword passes `{ brave: true, ma: true }`. PA-using content
  // (deferred) passes `{ pa: true, ... }`.
  readonly factors?: StatusFormulaFactors;
  // When `true`, formula is bypassed: the chance is set to 1.0, the
  // `modifyStatusApplicationChance` chain still fires (so future hooks
  // can gate even applyAlways effects), and the result is clamped to
  // [0, 1]. Per ADR-0028; v1 consumer is Taunt.
  readonly applyAlways?: boolean;
}

export interface StatusChanceResult {
  readonly chance: number; // post-modifier, clamped [0, 1]
  readonly roll: number;   // unit float drawn from the seed
  readonly applied: boolean;
}

export function rollStatusChance(args: StatusChanceArgs): StatusChanceResult {
  const chance = computeStatusChance(args);
  const subIndex = STATUS_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance };
}

// Pure status-application chance compute — same formula as
// `rollStatusChance` but without the random draw. Used by both
// `rollStatusChance` (the runtime, which then rolls) and the
// `src/engine/forecast/status-chance.ts` query (the UI's forecast hover,
// which displays the chance directly). Sharing the body keeps the runtime
// and forecast paths in lockstep — no chance to drift.
export function computeStatusChance(
  args: Omit<StatusChanceArgs, 'seed' | 'effectIndex'>,
): number {
  // Factor selection (per ADR-0028): when `args.factors` is omitted,
  // the default `{ faith: true, ma: true }` applies — preserving
  // Earth's canonical shape. When `args.factors` is provided, every
  // undeclared key is treated as `false` (full-override semantics) —
  // Stasis Sword's `{ brave: true, ma: true }` opts *out* of faith.
  const factors: Required<StatusFormulaFactors> =
    args.factors === undefined
      ? DEFAULT_FACTORS
      : {
          faith: args.factors.faith === true,
          brave: args.factors.brave === true,
          ma: args.factors.ma === true,
          pa: args.factors.pa === true,
          speed: args.factors.speed === true,
        };

  let preModifier: number;
  if (args.applyAlways === true) {
    // Unconditional pre-modifier value. Modifier chain still runs.
    preModifier = 1;
  } else {
    const baseFraction = Math.max(0, args.baseChance / 100);

    let factorProduct = 1;
    if (factors.faith) {
      factorProduct *= computeFaithFactor({
        state: args.state,
        catalog: args.catalog,
        attacker: args.caster,
        target: args.target,
      });
    }
    if (factors.brave) {
      factorProduct *= computeBraveFactor({
        state: args.state,
        catalog: args.catalog,
        attacker: args.caster,
        target: args.target,
      });
    }
    if (factors.ma) {
      const ma = runModifyStatQuery(args.state, args.catalog, {
        unit: args.caster,
        statName: 'ma',
        baseValue: args.caster.baseStats.ma,
      });
      factorProduct *= 0.9 + ma / 10;
    }
    if (factors.speed) {
      factorProduct *= computeSpeedFactor({
        state: args.state,
        catalog: args.catalog,
        caster: args.caster,
      });
    }
    if (factors.pa) {
      // PA_factor (S65, ADR-0108) — mirrors MA_factor's shape. First
      // consumer is Bull Rush's `{ brave, pa }` knockback gate; a
      // PA-using *status* applier may follow.
      const pa = runModifyStatQuery(args.state, args.catalog, {
        unit: args.caster,
        statName: 'pa',
        baseValue: args.caster.baseStats.pa,
      });
      factorProduct *= 0.9 + pa / 10;
    }

    const resistance = lookupStatusResistance(
      args.state,
      args.catalog,
      args.statusType,
      args.target,
    );
    // Uncapped resistance (per ADR-0057, supersedes ADR-0022). For
    // resistance > 100, resistanceFactor goes negative → preModifier
    // negative → final clamps to 0. For resistance < 0, factor > 1
    // → preModifier > 1 → final clamps to 1. The clamp at the bottom
    // of this function bounds the probability into [0, 1] regardless
    // of regime; absorption semantics ("resistance > 100 heals") don't
    // apply to status chance (statuses don't heal; they apply or don't).
    const resistanceFactor = (100 - resistance) / 100;

    preModifier = baseFraction * factorProduct * resistanceFactor;
  }

  // Caster-side modifier hooks (Earth Communion × 1.25, etc.) compose
  // multiplicatively against the caster's hooks. Earth Communion fires
  // for any status application, including Stasis Sword's Stop and
  // Taunt's Taunted — they're not gated by tag.
  const postCasterModifier = runModifyStatusApplicationChance(args.state, args.catalog, {
    caster: args.caster,
    target: args.target,
    statusType: args.statusType,
    ability: args.ability,
    baseChance: preModifier,
  });

  // Target-side modifier hooks (Pointy Hat × 0.5 on Silence, Focus Band
  // × 0.75 on negative-tagged statuses, etc.) compose multiplicatively
  // against the target's hooks after the caster chain. Final formula
  // (per ADR-0056, Session 27):
  //   final_chance = base × ∏casterHooks × ∏targetHooks
  // Clamp to [0, 1] at the return.
  const postTargetModifier = runModifyIncomingStatusApplicationChance(args.state, args.catalog, {
    target: args.target,
    caster: args.caster,
    statusType: args.statusType,
    ability: args.ability,
    baseChance: postCasterModifier,
  });

  return Math.max(0, Math.min(1, postTargetModifier));
}

// Look up the target's resistance against the status type's primary
// resistance tag (the type's declared `resistanceTag`), threaded
// through the `modifyResistance` hook chain. Missing tag means
// resistance 0 — the status can't be resisted; equipment / status
// contributors can introduce resistance for that tag (e.g., Capacitor
// Ring +50 Lightning). Multi-tag status resistance is future work;
// this single-tag shape keeps v1 scope tight. Per ADR-0056 (Session 27).
function lookupStatusResistance(
  state: GameState,
  catalog: Catalog,
  type: StatusEffectType,
  target: Unit,
): number {
  if (type.resistanceTag === undefined) return 0;
  const native = target.resistances.get(type.resistanceTag);
  return runModifyResistance(state, catalog, {
    unit: target,
    tag: type.resistanceTag,
    baseValue: native ?? 0,
  });
}

// Generic ability-chance roll for non-status rider effects: knockback
// gates on damage riders, free-standing CT effects (Tide Surge), and
// future content that needs the same Faith × MA chance shape without
// the status pipeline's resistance and modifier-hook composition.
//
// Formula: `baseChance × ∏selected_factors`, clamped to [0, 1]. No
// resistance lookup (CT effects / knockback don't carry a resistance
// tag in v1; if a future content consumer wants per-tag resistance,
// extend this shape). No modifier hook (Earth Communion's status-
// chance ×1.25 deliberately doesn't apply to non-status applications;
// adding a parallel hook for ability-chance is wave-2 work).
//
// Same factor-selection model as rollStatusChance (default `{ faith:
// true, ma: true }`; full-override semantics when `factors` is set).
export interface AbilityChanceArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly target: Unit;
  readonly baseChance: number; // [0, 100]
  readonly seed: number;
  readonly effectIndex?: number;
  readonly factors?: StatusFormulaFactors;
}

export interface AbilityChanceResult {
  readonly chance: number;
  readonly roll: number;
  readonly applied: boolean;
}

// Pure ability-chance compute — same formula as `rollAbilityChance` but
// without the random draw. Used by `rollAbilityChance` (the runtime, which
// then rolls) and by the AI scorer (S66 knockback valuation, which folds
// the expected knockback chance into an action's score). Sharing the body
// keeps the runtime and the AI's expected-value path in lockstep — the same
// discipline as `computeStatusChance`/`rollStatusChance`.
export function computeAbilityChance(
  args: Omit<AbilityChanceArgs, 'seed' | 'effectIndex'>,
): number {
  const factors: Required<StatusFormulaFactors> =
    args.factors === undefined
      ? DEFAULT_FACTORS
      : {
          faith: args.factors.faith === true,
          brave: args.factors.brave === true,
          ma: args.factors.ma === true,
          pa: args.factors.pa === true,
          speed: args.factors.speed === true,
        };

  const baseFraction = Math.max(0, args.baseChance / 100);
  let factorProduct = 1;
  if (factors.faith) {
    factorProduct *= computeFaithFactor({
      state: args.state,
      catalog: args.catalog,
      attacker: args.caster,
      target: args.target,
    });
  }
  if (factors.brave) {
    factorProduct *= computeBraveFactor({
      state: args.state,
      catalog: args.catalog,
      attacker: args.caster,
      target: args.target,
    });
  }
  if (factors.ma) {
    const ma = runModifyStatQuery(args.state, args.catalog, {
      unit: args.caster,
      statName: 'ma',
      baseValue: args.caster.baseStats.ma,
    });
    factorProduct *= 0.9 + ma / 10;
  }
  if (factors.speed) {
    factorProduct *= computeSpeedFactor({
      state: args.state,
      catalog: args.catalog,
      caster: args.caster,
    });
  }
  if (factors.pa) {
    // PA_factor (S65, ADR-0108) — see computeStatusChance. Bull Rush's
    // knockback chance rides this path with `{ brave, pa }`.
    const pa = runModifyStatQuery(args.state, args.catalog, {
      unit: args.caster,
      statName: 'pa',
      baseValue: args.caster.baseStats.pa,
    });
    factorProduct *= 0.9 + pa / 10;
  }

  return Math.max(0, Math.min(1, baseFraction * factorProduct));
}

export function rollAbilityChance(args: AbilityChanceArgs): AbilityChanceResult {
  const chance = computeAbilityChance(args);
  const subIndex = ABILITY_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance };
}

// Thief contest chance — the tuned-additive success form for Steal Buffs
// and (chunk 2) Steal Heart. Distinct from the multiplicative BMG status
// formula above:
//   chance% = clamp(baseChance + α·PA + β·(caster_Brave − target_Brave), [1, 95])
// with α = 3, β = 0.5 (concept-notes "Steal Heart success formula"). The
// target's Brave acts as RESISTANCE via the differential — unlike the
// multiplicative formula's symmetric Brave *product* (where high target
// Brave and high caster Brave both raise the term). The 95 cap means the
// game's biggest swings are never a guaranteed lock even under full setup;
// the floor of 1 leaves a sliver. PA and both Braves read through
// `runModifyStatQuery` so equipment / status modifiers compose. Returns a
// PERCENTAGE in [1, 95] (note: `rollAbilityChance` above returns a [0,1]
// fraction — this form is percent-native to match the concept-notes math).
const THIEF_CONTEST_ALPHA = 3;
const THIEF_CONTEST_BETA = 0.5;

export interface ThiefContestChanceArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly target: Unit;
  readonly baseChance: number;
}

export function computeThiefContestChance(args: ThiefContestChanceArgs): number {
  const pa = runModifyStatQuery(args.state, args.catalog, {
    unit: args.caster,
    statName: 'pa',
    baseValue: args.caster.baseStats.pa,
  });
  const casterBrave = runModifyStatQuery(args.state, args.catalog, {
    unit: args.caster,
    statName: 'brave',
    baseValue: args.caster.baseStats.brave,
  });
  const targetBrave = runModifyStatQuery(args.state, args.catalog, {
    unit: args.target,
    statName: 'brave',
    baseValue: args.target.baseStats.brave,
  });
  const raw =
    args.baseChance +
    THIEF_CONTEST_ALPHA * pa +
    THIEF_CONTEST_BETA * (casterBrave - targetBrave);
  return Math.max(1, Math.min(95, raw));
}

export interface ThiefContestRollArgs extends ThiefContestChanceArgs {
  readonly seed: number;
  readonly effectIndex?: number;
}

export interface ThiefContestRollResult {
  readonly chance: number; // percentage in [1, 95]
  readonly roll: number; // unit float drawn from the seed
  readonly applied: boolean;
}

export function rollThiefContestChance(args: ThiefContestRollArgs): ThiefContestRollResult {
  const chance = computeThiefContestChance(args);
  const subIndex = ABILITY_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance / 100 };
}

// mulberry32-style mixer matching engine/damage/handlers.ts. Returns a
// unit float in [0, 1).
function unitFloatFromSeed(seed: number, subIndex: number): number {
  let s = (seed ^ subIndex) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
