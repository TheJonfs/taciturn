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
//   - PA_factor    = (deferred — first PA-using consumer ships the formula)
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
import { runModifyStatQuery, runModifyStatusApplicationChance } from '../hooks/runners.ts';
import type { GameState, Unit } from '../types/index.ts';
import type { StatusFormulaFactors } from '../catalog/definitions/ability-definition.ts';
import { computeBraveFactor, computeFaithFactor } from '../damage/handlers.ts';

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
    if (factors.pa) {
      // Deferred per ADR-0028 — first PA-using consumer ships the
      // formula. v1 has no PA-using status applier; reaching this
      // branch is a content authoring error.
      throw new NotYetImplementedError(
        'PA_factor is declared on a StatusEffectSpec but the formula is not yet implemented; ' +
          'the first PA-using consumer ships the formula. Surface the consumer and revisit.',
      );
    }

    const resistance = lookupStatusResistance(args.statusType, args.target);
    const resistanceFactor = (100 - Math.min(100, resistance)) / 100;

    preModifier = baseFraction * factorProduct * resistanceFactor;
  }

  // Modifier hooks (Earth Communion × 1.25, etc.) compose
  // multiplicatively against the caster's hooks. Earth Communion fires
  // for any status application, including Stasis Sword's Stop and
  // Taunt's Taunted — they're not gated by tag.
  const postModifier = runModifyStatusApplicationChance(args.state, args.catalog, {
    caster: args.caster,
    target: args.target,
    statusType: args.statusType,
    ability: args.ability,
    baseChance: preModifier,
  });

  const chance = Math.max(0, Math.min(1, postModifier));
  const subIndex = STATUS_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance };
}

// Look up the target's resistance against the status type's primary
// resistance tag (the type's declared `resistanceTag`). Missing tag
// means resistance 0 — the status can't be resisted. Multi-tag
// status resistance is future work; this single-tag shape keeps v1
// scope tight.
function lookupStatusResistance(type: StatusEffectType, target: Unit): number {
  if (type.resistanceTag === undefined) return 0;
  const value = target.resistances.get(type.resistanceTag);
  return value ?? 0;
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

export function rollAbilityChance(args: AbilityChanceArgs): AbilityChanceResult {
  const factors: Required<StatusFormulaFactors> =
    args.factors === undefined
      ? DEFAULT_FACTORS
      : {
          faith: args.factors.faith === true,
          brave: args.factors.brave === true,
          ma: args.factors.ma === true,
          pa: args.factors.pa === true,
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
  if (factors.pa) {
    throw new NotYetImplementedError(
      'PA_factor is declared on an ability-chance roll but the formula is not yet implemented; ' +
        'the first PA-using consumer ships the formula.',
    );
  }

  const chance = Math.max(0, Math.min(1, baseFraction * factorProduct));
  const subIndex = ABILITY_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance };
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
