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
import { collectActiveHandlers } from '../hooks/collector.ts';
import {
  runModifyEvasion,
  runModifyHitChance,
  runModifyOutgoingHealing,
  runModifyOutgoingHitChance,
  runModifySpellPower,
  runModifyStatQuery,
  runOnDamageDealt,
  runOnDamageReceived,
  runOnFinalDamage,
  runOnFinalDamageReceived,
} from '../hooks/runners.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState } from '../types/index.ts';
import { getEquippedWeapon, getSwingWeapon } from '../items/equipment.ts';
import { tileAt } from '../map/accessors.ts';
import {
  getUnit,
  type DamageContext,
  type DamageTag,
  type EquipmentSlotId,
  type Unit,
} from '../types/index.ts';
import type { DamageHandler, PipelineEnv } from './registry.ts';
import {
  computeAttackerFacing,
  computeElevationModifier,
  pickEvasion,
} from './hit-chance-internals.ts';

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

// Brave_factor for hybrid physical-attack status applications (Stasis
// Sword, future Knight Battle Skill content). Same symmetric shape as
// Faith_factor — `(Brave_user / 100) × (Brave_target / 100)` — read
// through `modifyStatQuery` so future brave-modifying statuses compose.
// Per ADR-0028; first consumer is Stasis Sword's Stop application.
//
// Range: both factors are bounded by stat caps `[1, 100]`, producing a
// Brave_factor in `(0.0001, 1.0]`. v1 demo units default to brave 100,
// producing Brave_factor 1.0 — Stasis Sword's Stop chance reads cleanly
// off baseChance × MA_factor at the demo's tuning point.
export function computeBraveFactor(args: {
  readonly state: import('../types/index.ts').GameState;
  readonly catalog: import('../catalog/index.ts').Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
}): number {
  const userBrave = runModifyStatQuery(args.state, args.catalog, {
    unit: args.attacker,
    statName: 'brave',
    baseValue: args.attacker.baseStats.brave,
  });
  const targetBrave = runModifyStatQuery(args.state, args.catalog, {
    unit: args.target,
    statName: 'brave',
    baseValue: args.target.baseStats.brave,
  });
  return (userBrave / 100) * (targetBrave / 100);
}

// Speed_factor for the Assassin's instant status-application Command Set
// (Shadow Stitch, Blowdart, Undermine, Sow Doubt — per the Session 42
// brief). Unlike Faith/Brave (symmetric caster×target), Speed is
// caster-only: a fast Assassin lands debuffs more reliably regardless of
// the target's Speed. Formula `0.9 + caster_speed/40` mirrors the MA
// factor's `0.9 + ma/10` shape but with a /40 divisor (Speed values run
// higher than MA and Speed Save / Haste accumulate across a battle, so
// a flatter slope keeps the factor in a sane band even on a sped-up
// Assassin). Read through `modifyStatQuery` so Haste / Speed Save /
// Speed Down compose. At Assassin baseline Speed 14 → 0.9 + 0.35 ≈
// 1.25; at Speed 10 → 1.15; at Speed 20 (sped-up Speed Save build)
// → 1.40.
//
// S50 retune (two passes): divisor 20 → 30 → 40. Pre-S50 sped-up
// Assassin debuffs landed too reliably (Speed 14 → 1.6; Speed-Save +3
// → Speed 17 → 1.75); the first cut to /30 narrowed but didn't
// flatten the high-Speed wing enough, so /40 takes another step toward
// a gentler scaling. Keeps the high-Speed Assassin meaningfully better
// than a slow caster without nullifying targets' status defenses.
export function computeSpeedFactor(args: {
  readonly state: import('../types/index.ts').GameState;
  readonly catalog: import('../catalog/index.ts').Catalog;
  readonly caster: Unit;
}): number {
  const speed = runModifyStatQuery(args.state, args.catalog, {
    unit: args.caster,
    statName: 'spd',
    baseValue: args.caster.baseStats.spd,
  });
  return 0.9 + speed / 40;
}

// Default weapon-accuracy when a hitRoll spec doesn't override it. Per
// the Battle Mechanics Guide: "Default for 'no weapon / unarmed' is
// 100." Equipment integration in session 17 (per ADR-0014) will replace
// this with weapon-sourced accuracy; the per-ability override on
// `HitRollSpec.accuracy` stays as the per-ability lever.
//
// Read inline as `(hitRoll.accuracy ?? 100) / 100` in `evasionCheck`.

// --- base stage ---

// Physical: baseDamage = PA × WP × power_coefficient. Gated by the
// 'physical' tag. PA is read through `modifyStatQuery` so attack-up /
// strength buffs compose. WP reads from the attacker's equipped weapon
// (per ADR-0028); unarmed defaults to WP=1. The ability's
// `damage.power_coefficient` is its share of the product — when
// omitted, defaults to 1 (an ability that declares 'physical' without
// a coefficient does at least visible damage rather than silently zero).
//
// Weapon tag composition (per ADR-0028): when the ability's damage
// tags include 'weapon', the equipped weapon's `tags` are merged into
// the in-flight `ctx.damageTags` set. Downstream stages (resistance
// check, on-damage-dealt, on-damage-received) see the union, so a
// fire-imbued sword gets `'fire'` resistance lookup naturally without
// per-ability tag-redeclaration. Unarmed (no weapon equipped) skips
// the merge — the attack still resolves, just without weapon tags.
export const physicalPaWp: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('physical')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  const power_coefficient = effectivePowerCoefficient(
    ability,
    ctx.targetCount,
    ctx.additionalPowerCoefficient ?? 0,
  );
  const pa = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'pa',
    baseValue: ctx.attacker.baseStats.pa,
  });
  // Per-swing weapon scope (Session 42; shared resolver since S68): read
  // the designated swing slot's weapon when set, else the dominant weapon
  // (bit-identical for every single-weapon / pre-S42 caller).
  const weapon = getSwingWeapon(ctx.attacker, ctx.attackingWeaponSlot, env.catalog);
  const wp = weapon?.wp ?? 1;
  const baseDamage = pa * wp * power_coefficient;

  // Weapon tag composition: merge the weapon's declared tags into the
  // running tag set when the ability uses a weapon (signalled by the
  // 'weapon' tag on the ability's damage spec). The merge happens at
  // the base stage so subsequent stages see the complete tag set.
  let damageTags = ctx.damageTags;
  if (ctx.damageTags.has('weapon') && weapon !== null && weapon.tags !== undefined) {
    damageTags = mergeTags(ctx.damageTags, weapon.tags);
  }

  return { ...ctx, baseDamage, damageTags };
};

function mergeTags(
  base: ReadonlySet<DamageTag>,
  extra: ReadonlyArray<DamageTag>,
): ReadonlySet<DamageTag> {
  if (extra.length === 0) return base;
  const next = new Set(base);
  for (const tag of extra) next.add(tag);
  return next;
}

// Healing: MA × power × Faith_factor. The 'healing' tag is the polarity
// flip — finalize sees it and adds rather than subtracts. Faith is
// symmetric per the Battle Mechanics Guide ("Healing > Same formula —
// symmetric Faith"): high-Faith healer + high-Faith ally → full
// effect; low Faith on either side reduces effectiveness.
export const healingBase: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('healing')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  // Healing doesn't compose chainBonus today — no v1 ability is both
  // healing and AoE-chain-scaling. The default-1 power_coefficient
  // path is preserved. Session 49: Math Skill's additional power
  // (Mathematician's +1 SP) composes additively for Targeted Treatment.
  const power =
    (ability.effects.damage?.power_coefficient ?? 1) +
    (ctx.additionalPowerCoefficient ?? 0);
  const ma = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'ma',
    baseValue: ctx.attacker.baseStats.ma,
  });
  // S63: `noFaithScaling` forces the Faith term to 1 (deterministic
  // `MA × power`). Targeted Treatment opts out; standard heals keep Faith.
  const faithFactor = ability.effects.damage?.noFaithScaling === true
    ? 1
    : computeFaithFactor({
        state: env.state,
        catalog: env.catalog,
        attacker: ctx.attacker,
        target: ctx.target,
      });
  // Emissary (S62, ADR-0101): caster-side outgoing-healing multiplier,
  // pushed as a multiplier so it composes multiplicatively with faith / MA
  // / variance at the finalize fold. Skipped when the factor is 1 (no
  // healing-boost passive present).
  const healMult = runModifyOutgoingHealing(env.state, env.catalog, {
    unit: ctx.attacker,
    baseValue: 1,
  });
  return {
    ...ctx,
    baseDamage: ma * power * faithFactor,
    ...(healMult !== 1
      ? { multipliers: [...ctx.multipliers, { source: 'emissary', factor: healMult }] }
      : {}),
  };
};

// Lance bonus (S62, ADR-0103): Dragoon Jump's `× (1 + isLance)`. When the
// ability's damage declares `lanceBonus` and the attacker wields a Lance
// (a `'lance'`-tagged weapon), push a ×2 multiplier — composing with WP /
// crit / variance at the finalize fold. No-op otherwise, so a Jump with a
// non-Lance weapon deals the base `PA × WP`.
export const lanceBonus: DamageHandler = (ctx, env) => {
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  if (ability.effects.damage?.lanceBonus !== true) return ctx;
  const weapon = getEquippedWeapon(ctx.attacker, env.catalog);
  if (weapon === null || !(weapon.tags ?? []).includes('lance')) return ctx;
  return { ...ctx, multipliers: [...ctx.multipliers, { source: 'lance_jump', factor: 2 }] };
};

// Magical damage: MA × power × Faith_factor. Gated on the 'magical'
// tag. Per Battle Mechanics Guide "Magical damage": magical attacks
// always land for damage (no hit roll); resistance modifies damage
// (resistance_check stage handler); Faith modifies damage symmetrically.
export const magicalMaPower: DamageHandler = (ctx, env) => {
  if (!ctx.damageTags.has('magical')) return ctx;
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  // S68: caster-side Spell Power rider (Wand of Potential's +1 SP on
  // lightning magic). Additive on the power coefficient, gated on the
  // ability's damage tags by the contributor. Magical-only by virtue of
  // living in this handler; holder-gated because the chain collects the
  // caster's equipment. Composes with the chainBonus / Math-Skill
  // `additionalPowerCoefficient` already folded into the base. Per
  // ADR-0113.
  const spellPowerDelta = runModifySpellPower(env.state, env.catalog, {
    unit: ctx.attacker,
    ability,
    baseValue: 0,
  });
  const power =
    effectivePowerCoefficient(
      ability,
      ctx.targetCount,
      ctx.additionalPowerCoefficient ?? 0,
    ) + spellPowerDelta;
  const ma = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'ma',
    baseValue: ctx.attacker.baseStats.ma,
  });
  // S63: `noFaithScaling` forces the Faith term to 1 (deterministic
  // `MA × power`). Precision Fire opts out; standard spells keep Faith.
  const faithFactor = ability.effects.damage?.noFaithScaling === true
    ? 1
    : computeFaithFactor({
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

  // S46: physical attacks on Charging targets auto-hit per FFT canon —
  // a unit mid-cast is defenseless against incoming physical strikes.
  // Skip the whole roll: no accuracy lookup, no facing, no elevation.
  // Extension point: future content (a status that lets charging units
  // retain evasion, an ability-tag opt-out, an equipment override) adds
  // its branch into this predicate.
  const ruleset = env.catalog.getRuleset(env.state.ruleset.id);
  const chargingTypeId = ruleset.chargedActions.chargingStatusTypeId;
  if (ctx.target.statuses.some((s) => s.typeId === chargingTypeId)) return ctx;

  // Accuracy precedence (per ADR-0028): per-ability `hitRoll.accuracy`
  // override → equipped weapon's `accuracy` → unarmed default (100).
  // The override path lets specific abilities depart from weapon
  // accuracy (none in v1). S68: read the *swing* weapon (per slot) so a
  // dual-wield off-hand swing uses its own accuracy, not the dominant
  // weapon's — fixes the accuracy-launder exploit.
  const weapon = getSwingWeapon(ctx.attacker, ctx.attackingWeaponSlot, env.catalog);
  const accuracyPct = hitRoll.accuracy ?? weapon?.accuracy ?? 100;
  const accuracy = accuracyPct / 100;

  const targetClass = env.catalog.getClass(ctx.target.classState.currentClass);
  const facing = computeAttackerFacing(ctx.attacker.position, ctx.target.position, ctx.target.facing);
  const baseEvasionPct = pickEvasion(targetClass.evasion, facing);
  // Evasion modifier hook (per ADR-0028) — additive chain over
  // per-facing evasion. Bulwark Stance and friends compose here.
  const evasionPct = runModifyEvasion(env.state, env.catalog, {
    unit: ctx.target,
    attacker: ctx.attacker,
    baseEvasion: baseEvasionPct,
    facing,
  });
  const evasionFactor = 1 - evasionPct / 100;

  const elevationModifier = computeElevationModifier(env.state, ctx.attacker.position, ctx.target.position);

  const baseChance = accuracy * evasionFactor * elevationModifier;
  // Apply hit-chance modifiers in two passes: target-side (Blind) then
  // caster-side (Arcane Lens). Both are multiplicative; the runners
  // thread the value through each handler. Composition:
  //   final = base × ∏targetHooks × ∏casterHooks
  // The order of target vs caster within the composition is
  // associative — same final product either way — but running target-
  // first matches the existing pre-Session-29 trace order.
  const afterTarget = runModifyHitChance(env.state, env.catalog, {
    target: ctx.target,
    attacker: ctx.attacker,
    ability,
    baseHitChance: baseChance,
  });
  const modifiedChance = runModifyOutgoingHitChance(env.state, env.catalog, {
    attacker: ctx.attacker,
    target: ctx.target,
    ability,
    baseHitChance: afterTarget,
  });
  const hitChance = Math.max(0.05, Math.min(1.0, modifiedChance));

  const r = unitFloatFromSeed(env.seed, /* sub-index */ 1);
  if (r < hitChance) return ctx;
  return { ...ctx, hit: false };
};

// Per-tag resistance lookup, composed via signedMax (ADR-0015) with
// the per-tag `modifyResistance` hook chain (ADR-0056, Session 27).
// Healing-tagged effects skip the stage entirely (ADR-0016) — healing
// is unresisted. Damage-tagged effects look up `target.resistances` per
// tag, thread each tag through the additive hook chain, take the signed
// maximum across applicable tags, and apply the resulting multiplier to
// the in-flight damage.
//
// The Battle Mechanics Guide formula:
//   resistance_modifier = (100 − resistance) / 100
// For resistance = 50 → 0.5× (half damage); resistance = 0 → 1.0×
// (normal); resistance = 100 → 0× (immune); resistance = -50 → 1.5×
// (1.5× damage); resistance = -100 → 2.0× (double).
//
// **Absorption activated (per ADR-0057, supersedes ADR-0022).** The
// previous cap-at-100 has been lifted. Resistance > 100 produces a
// negative multiplier; `clampMinMax` (cap stage) detects negative raw
// damage and tag-flips to healing, capping the absorbed amount at the
// pre-multiplier base damage so resistance ≥ 200 heals for 100% of
// base (no further compounding above 200). See `clampMinMax`.
export const resistanceCheck: DamageHandler = (ctx, env) => {
  if (!ctx.hit) return ctx;
  if (ctx.damageTags.has('healing')) return ctx;
  const resistance = composeResistance(env.state, env.catalog, ctx.damageTags, ctx.target);
  if (resistance === 0) return ctx;
  const factor = (100 - resistance) / 100;
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

// Deterministic uniform roll within `[band.min, band.max]`, applied as
// a multiplier. Uses a hash of the per-action seed plus a small
// sub-index — matches the design's "stream-within-action" model.
//
// Per Session 31 (ADR-0067) + Session 40: the band fork. Physical hits
// whose wielder weapon declares `physicalVariance` resolve the band off
// the weapon instead of the ability's `ctx.variance`. War Axe (static
// `[0.9, 1.3]`, asymmetric, mean 1.1) and Bolt Hammer ride the static
// arm; knives ride the `attacker_speed` arm with a small ±0.05 spread,
// computing the band from the wielder's post-equipment Speed at action
// resolution time. Sword / wand / staff wielders without a declared
// band fall through to the ability's `ctx.variance` (default `{ 1, 1 }`
// → no-op short-circuit).
//
// Magical-only damage always reads `ctx.variance` regardless of
// equipped weapon — the weapon-side band gates on the 'physical' tag
// so a Wand-wielding Mage casting a spell still gets the ability's
// declared variance, not the wand's (which is none anyway).
//
// For the v1 MVP we use a tiny mulberry32-style mixer rather than
// pulling in a full PRNG: the seed is already the action's stable
// per-action value, and the variance roll is the only consumer in v1.
export const varianceRoll: DamageHandler = (ctx, env) => {
  const band = resolveVarianceBand(ctx, env);
  if (band.min === 1 && band.max === 1) return ctx;
  const r = unitFloatFromSeed(env.seed, /* sub-index */ 0);
  const factor = band.min + (band.max - band.min) * r;
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'variance', factor }],
  };
};

// Per Session 31 (ADR-0067) + Session 40. Physical hits with a wielder
// weapon that declares `physicalVariance` resolve the band off the
// weapon; everything else uses the ability's `ctx.variance`. The
// function is small and inline here so the variance stage stays
// single-file.
//
// `kind: 'static'` returns the literal `{ min, max }` band.
//
// `kind: 'attacker_speed'` (Session 40, knife class) computes the band
// from the wielder's effective Speed at action time, threading the
// stat through `modifyStatQuery` so Sai's +1 Speed and any future
// Speed-modifying contributors compose. Band:
//   center = Speed / 10
//   { min: center - spread, max: center + spread }
// Clamped to a non-negative minimum (Speed 0 is impossible per the
// stat caps; the clamp is belt-and-suspenders for the spread term).
function resolveVarianceBand(
  ctx: DamageContext,
  env: PipelineEnv,
): { readonly min: number; readonly max: number } {
  const ability = expectActiveAbility(env.catalog, ctx.sourceAbilityId);
  return resolvePhysicalVarianceBand(
    env.state,
    env.catalog,
    ctx.attacker,
    ctx.target,
    ability,
    ctx.attackingWeaponSlot,
  );
}

// Shared physical-variance-band resolver (per ADR-0067 + Session 40).
// Single source of truth for "what variance band does this physical
// attack roll within," used by the live `varianceRoll` handler, the AI /
// forecast projection (`src/ai/projection.ts`), and the UI damage-range
// forecast (`src/engine/forecast/damage-range.ts`) — the same sharing
// discipline as `readCritChance`. Before Session 42 the projection and
// forecast read only the ability's static `variance`, so knife
// (`attacker_speed`) damage was badly under-forecast (a Speed-16 knife
// rolls ~1.6×, not ~1.0×).
//
// Non-physical abilities and physical abilities whose wielder has no
// `physicalVariance` weapon fall back to the ability's declared band.
// `static` returns the literal band; `attacker_speed` computes
// `center = Speed/10` (Speed read through `modifyStatQuery` so equipment
// / status Speed modifiers compose) and returns `[center ± spread]`.
// `height_delta` (Session 45, bows) reads the target's tile elevation
// relative to the attacker's and collapses to a single deterministic
// point — the only arm that consults the target.
//
// S68: `attackingWeaponSlot` selects the swing's weapon (per slot) so a
// dual-wield off-hand swing resolves *its own* variance band, not the
// dominant weapon's. Omitted (the AI projection / UI forecast and every
// single-swing caller) → dominant weapon, bit-identical to pre-S68.
export function resolvePhysicalVarianceBand(
  state: GameState,
  catalog: Catalog,
  attacker: Unit,
  target: Unit,
  ability: ActiveAbilityDefinition,
  attackingWeaponSlot?: EquipmentSlotId,
): { readonly min: number; readonly max: number } {
  const damage = ability.effects.damage;
  const fallback = damage?.variance ?? { min: 1, max: 1 };
  if (damage === undefined || !damage.tags.includes('physical')) return fallback;
  const weapon = getSwingWeapon(attacker, attackingWeaponSlot, catalog);
  const source = weapon?.physicalVariance;
  if (source === undefined) return fallback;
  if (source.kind === 'static') {
    return { min: source.min, max: source.max };
  }
  if (source.kind === 'height_delta') {
    const aTile = tileAt(state.map, attacker.position.x, attacker.position.y, attacker.position.layer);
    const tTile = tileAt(state.map, target.position.x, target.position.y, target.position.layer);
    const aElev = aTile?.elevation ?? 0;
    const tElev = tTile?.elevation ?? 0;
    const factor = Math.max(0, 1 - source.falloffPerHeight * (tElev - aElev));
    return { min: factor, max: factor };
  }
  if (source.kind === 'attacker_brave') {
    // S50: Knight Sword class. Variance scales with the wielder's
    // post-equipment Brave (read through `modifyStatQuery` so Brave-
    // modifying contributors compose). Center = Brave/100 — a Brave-70
    // wielder lands at center 0.7, a Brave-100 wielder lands at 1.0.
    const brave = runModifyStatQuery(state, catalog, {
      unit: attacker,
      statName: 'brave',
      baseValue: attacker.baseStats.brave,
    });
    const center = brave / 100;
    return {
      min: Math.max(0, center - source.spread),
      max: Math.max(0, center + source.spread),
    };
  }
  // source.kind === 'attacker_speed'
  const speed = runModifyStatQuery(state, catalog, {
    unit: attacker,
    statName: 'spd',
    baseValue: attacker.baseStats.spd,
  });
  const center = speed / 10;
  return {
    min: Math.max(0, center - source.spread),
    max: Math.max(0, center + source.spread),
  };
}

// Shared crit_chance read site (per ADR-0034 / ADR-0042). Reads
// `crit_chance` through `runModifyStatQuery` so Crit_modifier and any
// future crit-boost hooks compose, then clamps to [0, 100] so multi-
// stack composition can't roll into undefined territory. Both the live
// `critRoll` handler and `src/ai/projection.ts`'s projection variant
// import this helper so the runtime, AI, and UI forecast all read the
// same value.
export function readCritChance(env: PipelineEnv, attacker: Unit): number {
  return Math.max(
    0,
    Math.min(
      100,
      runModifyStatQuery(env.state, env.catalog, {
        unit: attacker,
        statName: 'crit_chance',
        baseValue: attacker.baseStats.crit_chance,
      }),
    ),
  );
}

// Critical hit roll. Per ADR-0032: read `crit_chance` (a percentage in
// [0, 100]) and `crit_multiplier` from the attacker via
// `runModifyStatQuery` so Crit_modifier (Lightning Buff), future crit-
// boost equipment, and any other modifiers compose. Roll a deterministic
// uniform float against `crit_chance / 100`; on hit, append a
// multiplier of `crit_multiplier` to ctx.multipliers.
//
// Composition: crit layers ON TOP of every other multiplier (variance,
// resistance, Vulnerable, etc.) — it's a separate damage-pipeline
// multiplier, not a replacement for variance. A 5% crit at × 1.5 on top
// of a Vulnerable target's × 1.5 yields × 2.25 effective. Per Chris's
// session 20 plaintext call.
//
// Short-circuits when:
//  - the action missed (`ctx.hit === false`) — variance/finalize already
//    discard the contributions;
//  - the attacker's queried `crit_chance` is <= 0 — pre-tuned fixtures
//    that opt out of crits set crit_chance to 0;
//  - the damage carries the 'healing' tag — crits on healing isn't a
//    v1 mechanic; the BMG positions crit as a damage-only outcome.
//
// Seed sub-stream: index 4. (variance 0, evasion 1, brave 2, status
// chance 3, ability chance 16 — picking 4 keeps crit adjacent to the
// damage-pipeline rolls.)
export const critRoll: DamageHandler = (ctx, env) => {
  if (!ctx.hit) return ctx;
  if (ctx.damageTags.has('healing')) return ctx;
  const crit_chance = readCritChance(env, ctx.attacker);
  if (crit_chance <= 0) return ctx;
  const r = unitFloatFromSeed(env.seed, /* sub-index */ 4);
  if (r >= crit_chance / 100) return ctx;
  const crit_multiplier = runModifyStatQuery(env.state, env.catalog, {
    unit: ctx.attacker,
    statName: 'crit_multiplier',
    baseValue: ctx.attacker.baseStats.crit_multiplier,
  });
  return {
    ...ctx,
    multipliers: [...ctx.multipliers, { source: 'crit', factor: crit_multiplier }],
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
//
// **Absorption (per ADR-0057, supersedes ADR-0022).** Resistance > 100
// produces a negative multiplier — raw < 0 for a non-healing damage
// source. This handler detects that case, adds the `'healing'` tag to
// ctx.damageTags (tag-flip), and converts the magnitude to a heal
// clamped at the pre-multiplier baseDamage (so resistance ≥ 200 heals
// for at most 100% of base; no compounding above 200). Downstream
// consumers — `applyDamageToTarget`, perTargetResult recording, the
// CT-push rider's `!has('healing')` gate, the action log formatter —
// all route through the existing healing path naturally. The tag-flip
// is contained to this stage; the earlier resistance / damage stages
// already ran with the original tag set.
export const clampMinMax: DamageHandler = (ctx, env) => {
  const raw = computeRawDamage(ctx);
  const isHealing = ctx.damageTags.has('healing');
  if (isHealing) {
    const maxHp = runModifyStatQuery(env.state, env.catalog, {
      unit: ctx.target,
      statName: 'maxHp',
      baseValue: ctx.target.baseStats.maxHpBase,
    });
    const room = Math.max(0, maxHp - ctx.target.vitals.hp);
    return { ...ctx, finalDamage: Math.min(raw, room) };
  }
  if (raw < 0) {
    // Absorption: the resistance multiplier flipped the result negative.
    // Cap the absorbed amount at the pre-multiplier base damage so
    // resistance ≥ 200 heals exactly base × 1.0 (not base × |multiplier|
    // — that would compound above 200). Apply max-HP room cap so we
    // don't over-heal.
    const absorbed = Math.min(-raw, ctx.baseDamage);
    const maxHp = runModifyStatQuery(env.state, env.catalog, {
      unit: ctx.target,
      statName: 'maxHp',
      baseValue: ctx.target.baseStats.maxHpBase,
    });
    const room = Math.max(0, maxHp - ctx.target.vitals.hp);
    const nextTags = new Set(ctx.damageTags);
    nextTags.add('healing');
    return { ...ctx, damageTags: nextTags, finalDamage: Math.min(absorbed, room) };
  }
  return { ...ctx, finalDamage: Math.max(0, raw) };
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

// --- postFinalize stage (Session 30, ADR-0065) ---

// Fires `onFinalDamage` against the attacker's hooks after finalize has
// produced the integer `damageDealt`. Emission-only: handlers may append
// to `ctx.emittedActions` but cannot mutate the damage. The `absorbed`
// arg signals when the cap stage tag-flipped the result to healing
// (resistance > 100 per ADR-0057); handlers gate on it (Rasp Pendant
// skips MP drain on absorbed hits).
export const fireOnFinalDamage: DamageHandler = (ctx, env) => {
  const attacker = getUnit(env.state, ctx.attacker.id);
  const target = getUnit(env.state, ctx.target.id);
  const damageDealt = ctx.finalDamage ?? 0;
  const absorbed = ctx.damageTags.has('healing');
  const emissions = runOnFinalDamage(env.state, env.catalog, {
    unit: attacker,
    target,
    damageDealt,
    damageTags: ctx.damageTags,
    absorbed,
  });
  if (emissions.length === 0) return ctx;
  const accumulated = ctx.emittedActions ? [...ctx.emittedActions, ...emissions] : [...emissions];
  return { ...ctx, emittedActions: accumulated };
};

// Target-side mirror of `fireOnFinalDamage` (Session 37). Fires
// `onFinalDamageReceived` against the *target's* hooks after finalize
// has written the integer `damageDealt`. Spiked Mail's
// `physicalReflectContributor` is the first consumer — it emits a
// `system_damage { source: 'revenge', ... }` against the attacker.
//
// Loop guard is automatic: `system_damage` bypasses the seven-stage
// damage pipeline (per ADR-0027), so a revenge emission never reaches
// this stage again, regardless of whether the attacker itself wears
// reflective gear.
export const fireOnFinalDamageReceived: DamageHandler = (ctx, env) => {
  const attacker = getUnit(env.state, ctx.attacker.id);
  const target = getUnit(env.state, ctx.target.id);
  const damageDealt = ctx.finalDamage ?? 0;
  const absorbed = ctx.damageTags.has('healing');
  const emissions = runOnFinalDamageReceived(env.state, env.catalog, {
    unit: target,
    attacker,
    damageDealt,
    damageTags: ctx.damageTags,
    absorbed,
  });
  if (emissions.length === 0) return ctx;
  const accumulated = ctx.emittedActions ? [...ctx.emittedActions, ...emissions] : [...emissions];
  return { ...ctx, emittedActions: accumulated };
};

// Compose the effective `power_coefficient` for a base-stage handler.
// Per ADR-0032: when the ability declares `damage.chainBonus`, the
// scalar grows with the AoE cluster size:
//   power_coefficient + powerPerAdditionalTarget × max(0, targetCount - 1)
// Single-target casts (targetCount === 1) read the unmodified
// `power_coefficient`. Used by physical and magical bases. Healing
// does not call this — no v1 healing ability scales with cluster size.
function effectivePowerCoefficient(
  ability: import('../catalog/index.ts').ActiveAbilityDefinition,
  targetCount: number,
  additionalPowerCoefficient: number = 0,
): number {
  const base = ability.effects.damage?.power_coefficient ?? 1;
  const chainBonus = ability.effects.damage?.chainBonus;
  const chainAdditional =
    chainBonus !== undefined
      ? chainBonus.powerPerAdditionalTarget * Math.max(0, targetCount - 1)
      : 0;
  return base + chainAdditional + additionalPowerCoefficient;
}

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
// Facing classification, per-facing evasion lookup, and elevation
// modifier all live in `./hit-chance-internals.ts` so the forecast
// helper (`computeOutgoingHitChance`) shares them with `evasionCheck`
// without duplication. Per Session 30 fold-in.

// signedMax — returns the largest signed value in the list, defaulting
// to 0 when empty. Per ADR-0015: most resistant tag wins; ties between
// equal-magnitude resistance and weakness resolve to the resistant
// (positive) side. The natural Math.max behavior.
function signedMax(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => Math.max(a, b));
}

// Resolve the effective resistance for a damage effect against a
// target. Iterates the effect's non-healing tags, threads each tag's
// resistance through the `modifyResistance` hook chain (additive;
// equipment / status / passive contributors fire on the target), and
// returns the signed maximum across the included tags.
//
// Tags not in the target's resistance map are SKIPPED (not treated as
// "explicit 0") **unless a contributor produces a non-zero value for
// that tag**. Per ADR-0015's spirit — designers store the resistances
// that apply to a unit; an absent tag means "this tag isn't relevant
// to this unit's defense," not "this unit has a declared 0 resistance
// that should preempt other tags." Equipment / status contributors
// can introduce new tags the unit doesn't natively carry (Capacitor
// Ring +50 Lightning on a unit with no native Lightning entry); when
// they do, the post-chain value is non-zero and the tag participates
// in the signedMax. Per ADR-0056 (Session 27) — preserves ADR-0015's
// fix while allowing equipment / status / future content to introduce
// resistances mid-battle.
function composeResistance(
  state: GameState,
  catalog: Catalog,
  tags: ReadonlySet<DamageTag>,
  target: Unit,
): number {
  // Collect once per call — the per-tag chain reuses the same handler
  // list. Empty handlers list (the v1 case) means the chain is a no-op
  // and only native entries contribute, preserving pre-Session-27
  // behavior.
  const handlers = collectActiveHandlers(state, target.id, catalog, 'modifyResistance');
  const values: number[] = [];
  for (const tag of tags) {
    if (tag === 'healing') continue;
    const native = target.resistances.get(tag);
    let value = native ?? 0;
    for (const h of handlers) {
      value = h.invoke({ unit: target, tag, baseValue: value });
    }
    // Include the tag iff the unit natively carries it OR a contributor
    // produced a non-zero value. A contributor that returns 0 for a
    // tag the unit doesn't natively carry is treated as "no opinion" —
    // ADR-0015 preserved.
    if (native !== undefined || value !== 0) {
      values.push(value);
    }
  }
  return signedMax(values);
}
