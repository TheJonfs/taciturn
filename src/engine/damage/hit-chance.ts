// Hit-chance helper — pure computation of the effective hit chance for
// a (attacker, target, ability) triple, without rolling the per-action
// RNG.
//
// Mirrors the math in `evasionCheck` (handlers.ts) but returns the
// final probability rather than mutating ctx. Single-source-of-truth
// for "what hit chance would the player see"; forecast / tooltip / AI
// projection all consume it.
//
// Per Session 30 fold-in. The composition follows the BMG formula
// embedded in evasionCheck:
//   base = accuracy × (1 − evasion/100) × elevation_modifier
//   final = base × ∏targetHooks × ∏casterHooks   (multiplicative)
//   final = clamp(final, [0.05, 1.0])
//
// Magical-only damage always lands (no hit roll); the helper returns
// `1.0` in that case. Abilities without a `hitRoll` declaration return
// `1.0` as well (auto-hit). Healing returns `1.0`.

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, Unit } from '../types/index.ts';
import { getEquippedWeapon } from '../items/equipment.ts';
import { runModifyEvasion, runModifyHitChance, runModifyOutgoingHitChance } from '../hooks/runners.ts';
import {
  computeAttackerFacing,
  computeElevationModifier,
  pickEvasion,
} from './hit-chance-internals.ts';

export interface ComputeHitChanceArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly attacker: Unit;
  readonly target: Unit;
  readonly ability: ActiveAbilityDefinition;
}

// Returns the effective hit chance in [0.05, 1.0]. Returns 1.0 for
// auto-hit abilities (no `hitRoll`) and for non-physical damage casts.
export function computeOutgoingHitChance(args: ComputeHitChanceArgs): number {
  const { state, catalog, attacker, target, ability } = args;

  const damage = ability.effects.damage;
  if (damage === undefined) return 1.0;
  const tags = new Set(damage.tags);
  // Magical-only damage always lands (per Battle Mechanics Guide and
  // evasionCheck's gate). Healing follows the same rule.
  if (!tags.has('physical')) return 1.0;

  const hitRoll = ability.hitRoll;
  if (hitRoll === undefined) return 1.0;

  // S46: physical attacks on Charging targets auto-hit per FFT canon —
  // mirror `evasionCheck`'s pre-roll guard so the forecast UI displays
  // 100% rather than the rolled chance the engine would otherwise
  // compute (which the engine then ignores anyway).
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const chargingTypeId = ruleset.chargedActions.chargingStatusTypeId;
  if (target.statuses.some((s) => s.typeId === chargingTypeId)) return 1.0;

  const weapon = getEquippedWeapon(attacker, catalog);
  const accuracyPct = hitRoll.accuracy ?? weapon?.accuracy ?? 100;
  const accuracy = accuracyPct / 100;

  const targetClass = catalog.getClass(target.classState.currentClass);
  const facing = computeAttackerFacing(attacker.position, target.position, target.facing);
  const baseEvasionPct = pickEvasion(targetClass.evasion, facing);
  const evasionPct = runModifyEvasion(state, catalog, {
    unit: target,
    attacker,
    baseEvasion: baseEvasionPct,
    facing,
  });
  const evasionFactor = 1 - evasionPct / 100;

  const elevationModifier = computeElevationModifier(state, attacker.position, target.position);

  const baseChance = accuracy * evasionFactor * elevationModifier;
  const afterTarget = runModifyHitChance(state, catalog, {
    target,
    attacker,
    ability,
    baseHitChance: baseChance,
  });
  const final = runModifyOutgoingHitChance(state, catalog, {
    attacker,
    target,
    ability,
    baseHitChance: afterTarget,
  });
  return Math.max(0.05, Math.min(1.0, final));
}
