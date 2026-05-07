// Default damage-pipeline stage handlers — the engine's library of
// handler refs that ruleset authors compose into stage lists.
//
// Per the design doc (action-resolution.md "Damage pipeline"), v1
// MVP-flavored content covers physical and healing only. Magical,
// elemental, evasion, holy/dark amplification all add as additional
// handlers in later content-expansion passes; the pipeline orchestrator
// already supports them — only the registry list grows.
//
// Each handler is pure given (ctx, env). Stage handlers may:
//  - Replace baseDamage (the base stage).
//  - Append multipliers / additives (attacker, target, environment).
//  - Roll variance (the variance stage).
//  - Apply min/max caps (the cap stage).
//  - Set finalDamage (the finalize stage).
// They never mutate state; they never re-fire hooks themselves (the
// pipeline orchestrator does that at the appropriate stage).

import { expectActiveAbility } from '../actions/validate.ts';
import {
  runModifyHitChance,
  runModifyStatQuery,
  runOnDamageDealt,
  runOnDamageReceived,
} from '../hooks/runners.ts';
import {
  getUnit,
  type DamageContext,
  type DamageTag,
  type Direction,
  type Position,
  type Unit,
} from '../types/index.ts';
import type { DamageHandler } from './registry.ts';

// Faith_factor for symmetric magical formulas — `(Faith_user / 100) ×
// (Faith_target / 100)` per docs/battle-mechanics-guide.md "Magical
// damage" and "Status effects > Status application chance". Used by
// `magical_ma_power` (damage), `healing_base` (healing), and the future
// status application formula. Faith is read through `modifyStatQuery`
// so future faith-modifying buffs/debuffs compose; v1 has no such
// status, so the chain is identity today.
//
// Range: both factors are bounded by stat caps `[1, 100]`, producing a
// Faith_factor in `(0.0001, 1.0]`. The function never returns 0 because
// stat caps prevent faith=0; the floor is `0.01 × 0.01 = 0.0001`. v1
// tuning has demo units at faith 80, producing factor 0.64.
export function computeFaithFactor(args: {
  readonly state: import('../types/index.ts').GameState;
  readonly catalog: import('../catalog/index.ts').Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
}): number {
  const userFaith = runModifyStatQuery(args.state, args.catalog, {
    unit: args.attacker,
    statName: 'faith',
    baseValue: args.attacker.baseStats.faith,
  });
  const targetFaith = runModifyStatQuery(args.state, args.catalog, {
    unit: args.target,
    statName: 'faith',
    baseValue: args.target.baseStats.faith,
  });
  return (userFaith / 100) * (targetFaith / 100);
}

// Default weapon-accuracy when a hitRoll spec doesn't override it. Per
// the Battle Mechanics Guide: "Default for 'no weapon / unarmed' is
// 100." Equipment integration in session 17 (per ADR-0014) will replace
// this with weapon-sourced accuracy; the per-ability override on
// `HitRollSpec.accuracy` stays as the per-ability lever.
//
// Read inline as `(hitRoll.accuracy ?? 100) / 100` in `evasionCheck`.

// --- base stage ---

// Physical: baseDamage = PA × power. Gated by the 'physical' tag.
// PA is read through `modifyStatQuery` so attack-up / strength buffs
// compose. The ability's `damage.power` is the weapon-power coefficient
// — when omitted, the conservative default of 1 keeps an ability that
// declared `physical` without `power` doing visible damage rather than
// silently zero.
export const physicalPaWp: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('physical')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const power = ability.effects.damage?.power ?? 1;
  const pa = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'pa',
    baseValue: ctx.attacker.baseStats.pa,
  });
  return { ...ctx, baseDamage: pa * power };
};

// Healing: MA × power × Faith_factor. The 'healing' tag is the polarity
// flip — finalize sees it and adds rather than subtracts. Faith is
// symmetric per the Battle Mechanics Guide ("Healing > Same formula —
// symmetric Faith"): high-Faith healer + high-Faith ally → full
// effect; low Faith on either side reduces effectiveness.
export const healingBase: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('healing')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const power = ability.effects.damage?.power ?? 1;
  const ma = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'ma',
    baseValue: ctx.attacker.baseStats.ma,
  });
  const faithFactor = computeFaithFactor({
    state: env.state,
    catalog: env.catalog,
    attacker: ctx.attacker,
    target: ctx.target,
  });
  return { ...ctx, baseDamage: ma * power * faithFactor };
};

// Magical damage: MA × power × Faith_factor. Gated on the 'magical'
// tag. Per Battle Mechanics Guide "Magical damage": magical attacks
// always land for damage (no hit roll); resistance modifies damage
// (resistance_check stage handler); Faith modifies damage symmetrically.
export const magicalMaPower: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('magical')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const power = ability.effects.damage?.power ?? 1;
  const ma = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'ma',
    baseValue: ctx.attacker.baseStats.ma,
  });
  const faithFactor = computeFaithFactor({
    state: env.state,
    catalog: env.catalog,
    attacker: ctx.attacker,
    target: ctx.target,
  });
  return { ...ctx, baseDamage: ma * power * faithFactor };
};

// --- attacker stage ---

// Fires onDamageDealt against the *attacker's* hooks. Each handler
// returns the next ctx; the runner threads them through.
export const fireOnDamageDealt: DamageHandler = (ctx, env) => {
  const attacker = getUnit(env.state, ctx.attacker.id);
  return runOnDamageDealt(env.state, env.catalog, { unit: attacker, ctx });
};

// --- target stage ---

// Evasion check (per ADR-0019). Computes physical hit chance:
//   hit_chance = weapon_accuracy
//              × (1 − target_evasion[facing] / 100)
//              × elevation_modifier
//              × hit_modifiers
// clamped to [0.05, 1.0]. Rolls against the per-action seed; sets
// `ctx.hit = false` when the roll fails. Finalize reads `ctx.hit` and
// produces finalDamage = 0 when missed.
//
// Short-circuits in three cases:
//  - The action's ability omits `hitRoll` (auto-hit per the format spec).
//  - The damage tag set has no 'physical' tag (magical-only damage
//    always lands per the Battle Mechanics Guide).
//  - The current `ctx.hit` is already false (a prior handler missed it
//    — keep the miss; don't roll again).
//
// `hit_modifiers` is the multiplicative product of any hooks that
// contributed during attacker / target stages — composed via
// `runModifyHitChance` against the target's hooks. Blind (negative
// status, factor < 1.0) and future Concentration (positive support,
// factor > 1.0) live on this hook. The composed `hit_chance` is
// clamped to [0.05, 1.0] last.
//
// Seed sub-stream: index 1. (variance uses 0; brave roll uses 2.) Keeps
// each random-rolling subsystem on a distinct sub-stream so a change in
// one doesn't shift the others.
export const evasionCheck: DamageHandler = (ctx, env) => {
  if (!ctx.hit) return ctx;
  if (!ctx.damageTags.has('physical')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const hitRoll = ability.hitRoll;
  if (hitRoll === undefined) return ctx;

  const accuracy = (hitRoll.accuracy ?? 100) / 100;
  const targetClass = env.catalog.getClass(ctx.target.classState.currentClass);
  const facing = computeAttackerFacing(ctx.attacker.position, ctx.target.position, ctx.target.facing);
  const evasionPct = pickEvasion(targetClass.evasion, facing);
  const evasionFactor = 1 - evasionPct / 100;

  const elevationModifier = computeElevationModifier(env.state, ctx.attacker.position, ctx.target.position);

  const baseChance = accuracy * evasionFactor * elevationModifier;
  // Apply hit-chance modifiers (Blind, etc.). The runner threads the
  // value through each handler's multiplicative return.
  const modifiedChance = runModifyHitChance(env.state, env.catalog, {
    target: ctx.target,
    attacker: ctx.attacker,
    ability,
    baseHitChance: baseChance,
  });
  const hitChance = Math.max(0.05, Math.min(1.0, modifiedChance));

  const r = unitFloatFromSeed(env.seed, /* sub-index */ 1);
  if (r < hitChance) return ctx;
  return { ...ctx, hit: false };
};

// Per-tag resistance lookup, composed via signedMax (ADR-0015).
// Healing-tagged effects skip the stage entirely (ADR-0016) — healing
// is unresisted. Damage-tagged effects look up `target.resistances` per
// tag, take the signed maximum across applicable tags, and apply the
// resulting multiplier to the in-flight damage.
//
// The Battle Mechanics Guide formula:
//   resistance_modifier = (100 − resistance) / 100
// For resistance = 50 → 0.5× (half damage); resistance = 0 → 1.0×
// (normal); resistance = 100 → 0× (immune); resistance = -50 → 1.5×
// (1.5× damage); resistance = -100 → 2.0× (double).
//
// **Absorption deferred (per ADR-0020):** the full BMG scale extends
// to resistance = 200 (full absorption — damage flips to healing). v1
// has no content with resistance > 100, so the absorption code path is
// uncovered. The handler caps the resistance value at 100 (immune) and
// emits the multiplier from `(100 − cappedResistance) / 100`. When the
// first content with resistance > 100 ships, this clamp is removed and
// the absorption path lands with a real consumer.
export const resistanceCheck: DamageHandler = (ctx) => {
  if (!ctx.hit) return ctx;
  if (ctx.damageTags.has('healing')) return ctx;
  const resistance = composeResistance(ctx.damageTags, ctx.target);
  if (resistance === 0) return ctx;
  const capped = Math.min(100, resistance);
  const factor = (100 - capped) / 100;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'resistance', factor }],
  };
};

// Fires onDamageReceived against the *target's* hooks. Runs after
// evasion_check + resistance_check at the target stage so handlers see
// the resolved hit + resistance-adjusted ctx.
export const fireOnDamageReceived: DamageHandler = (ctx, env) => {
  const target = getUnit(env.state, ctx.target.id);
  return runOnDamageReceived(env.state, env.catalog, { unit: target, ctx });
};

// --- environment stage ---
// (No v1 handlers. Elevation differential, terrain modifiers, weather
// arrive with the map-content expansion pass.)

// --- variance stage ---

// Deterministic uniform roll within `[variance.min, variance.max]`,
// applied as a multiplier. Uses a hash of the per-action seed plus a
// small sub-index — matches the design's "stream-within-action" model.
//
// For the v1 MVP we use a tiny mulberry32-style mixer rather than
// pulling in a full PRNG: the seed is already the action's stable
// per-action value, and the variance roll is the only consumer in v1.
export const varianceRoll: DamageHandler = (ctx, env) => {
  if (ctx.variance.min === 1 && ctx.variance.max === 1) return ctx;
  const r = unitFloatFromSeed(env.seed, /* sub-index */ 0);
  const factor = ctx.variance.min + (ctx.variance.max - ctx.variance.min) * r;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'variance', factor }],
  };
};

function unitFloatFromSeed(seed: number, subIndex: number): number {
  // mulberry32 of (seed XOR subIndex) → unit float in [0, 1).
  let s = (seed ^ subIndex) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// --- cap stage ---

// Damage: floor at 0 (no negative damage; KO is at HP 0). Healing: ceil
// at the target's effective max HP minus current HP. The clamp runs
// against the running raw value (base + additives × multipliers, before
// finalize sets the explicit finalDamage). To avoid a double-walk, this
// handler computes the running value, clamps, and stashes it on the
// context as the start of finalDamage; the finalize handler reads it.
export const clampMinMax: DamageHandler = (ctx, env) => {
  const raw = computeRawDamage(ctx);
  const isHealing = ctx.damageTags.has('healing');
  let clamped: number;
  if (isHealing) {
    const target = ctx.target;
    const maxHp = runModifyStatQuery(env.state, env.catalog, {
      unit: target,
      statName: 'maxHp',
      baseValue: target.baseStats.maxHpBase,
    });
    const room = Math.max(0, maxHp - target.vitals.hp);
    clamped = Math.min(raw, room);
  } else {
    clamped = Math.max(0, raw);
  }
  return { ...ctx, finalDamage: clamped };
};

// --- finalize stage ---

// Read the cap-set finalDamage; if the cap stage didn't run (a custom
// ruleset that drops it), compute on the fly. The integer floor matches
// FFT's display values (no fractional HP).
//
// Per ADR-0019, finalize reads `ctx.hit` and zeroes finalDamage on a
// missed roll. This is the single chokepoint where miss → 0 damage; the
// orchestrator and other stages stay uniform regardless of hit value.
// (Variance and cap still run on a miss; their contributions are
// discarded here. Profiling can revisit if it matters.)
export const finalize: DamageHandler = (ctx) => {
  if (!ctx.hit) return { ...ctx, finalDamage: 0 };
  const value = ctx.finalDamage ?? computeRawDamage(ctx);
  return { ...ctx, finalDamage: Math.floor(value) };
};

// Helper — apply additives, then multipliers, against baseDamage.
function computeRawDamage(ctx: DamageContext): number {
  let value = ctx.baseDamage;
  for (const a of ctx.additives) value += a.amount;
  for (const m of ctx.multipliers) value *= m.factor;
  return value;
}

// --- evasion / resistance helpers ---

// Classify the attacker's position relative to the target's facing as
// front, side, or back. Per the Battle Mechanics Guide:
//   - within ±45° of facing → Front
//   - within 45-135° on either side → Side
//   - within 135-180° → Back
//
// With cardinal facing (N/E/S/W), this reduces to a simple dot-product
// check between the target→attacker direction vector and the target's
// facing vector. Cosine ≥ √2/2 (≈ 0.7071) → front; cosine ≤ -√2/2 →
// back; otherwise side. The grid layer dimension is ignored — facing
// is a 2D model.
//
// Edge case: attacker on the same tile as target is degenerate and
// shouldn't happen in v1 (an ability targets self via `'self'`
// targeting, not by passing the attacker's own position). When it does,
// returns 'front' as a safe default.
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
  // Facing vector. y increases downward (S = +y, N = -y).
  let fx = 0;
  let fy = 0;
  switch (facing) {
    case 'N': fy = -1; break;
    case 'S': fy = 1; break;
    case 'E': fx = 1; break;
    case 'W': fx = -1; break;
  }
  const cos = ux * fx + uy * fy;
  const COS_45 = Math.SQRT1_2; // √2 / 2 ≈ 0.7071
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

// Elevation modifier per BMG: attacker higher → 1.05; attacker lower →
// 0.95; same elevation → 1.0. Reads tile elevation at the attacker's
// and target's positions. If either tile is missing (impossible in v1
// well-formed maps but defensive), returns 1.0.
function computeElevationModifier(
  state: import('../types/index.ts').GameState,
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

// signedMax — returns the largest signed value in the list, defaulting
// to 0 when empty. Per ADR-0015: most resistant tag wins; ties between
// equal-magnitude resistance and weakness resolve to the resistant
// (positive) side. The natural Math.max behavior.
function signedMax(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => Math.max(a, b));
}

// Resolve the effective resistance for a damage effect against a
// target. Iterates the effect's non-healing tags, looks up each tag's
// resistance on the target (defaulting to 0 for unmapped tags), and
// returns the signed maximum.
function composeResistance(tags: ReadonlySet<DamageTag>, target: Unit): number {
  const values: number[] = [];
  for (const tag of tags) {
    if (tag === 'healing') continue;
    values.push(target.resistances.get(tag) ?? 0);
  }
  return signedMax(values);
}
