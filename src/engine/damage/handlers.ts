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
import { runOnDamageDealt, runOnDamageReceived } from '../hooks/runners.ts';
import { runModifyStatQuery } from '../hooks/runners.ts';
import { getUnit, type DamageContext } from '../types/index.ts';
import type { DamageHandler } from './registry.ts';

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

// Healing: same shape as physical but reads MA. The 'healing' tag is
// the polarity flip — finalize sees it and adds rather than subtracts.
export const healingBase: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('healing')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const power = ability.effects.damage?.power ?? 1;
  const ma = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'ma',
    baseValue: ctx.attacker.baseStats.ma,
  });
  return { ...ctx, baseDamage: ma * power };
};

// --- attacker stage ---

// Fires onDamageDealt against the *attacker's* hooks. Each handler
// returns the next ctx; the runner threads them through.
export const fireOnDamageDealt: DamageHandler = (ctx, env) => {
  const attacker = getUnit(env.state, ctx.attacker.id);
  return runOnDamageDealt(env.state, env.catalog, { unit: attacker, ctx });
};

// --- target stage ---

// Fires onDamageReceived against the *target's* hooks.
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
export const finalize: DamageHandler = (ctx) => {
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
