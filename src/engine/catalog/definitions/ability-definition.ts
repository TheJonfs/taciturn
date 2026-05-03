// AbilityDefinition — the catalog definition of an ability.
// See docs/design/ability-slots.md and docs/design/action-resolution.md.
//
// Session 5 added the slot/cost/kind fields and the passive `hooks` list.
// Session 7 added the action payload and effect specification (targeting,
// range, charge time, MP cost, effects). Session 8 will flesh out the
// damage spec into a real pipeline-driving shape.
//
// Discriminated by `kind`:
// - `'active'`  — usable inside a command set; lives only inside an
//   ActiveBucket (via its containing CommandSet). Carries the targeting
//   mode, range, charge time, MP cost, and effect specification.
// - `'passive'` — equipped directly into a Passive bucket. Its hook
//   handlers (per ADR-0005's typing pattern) fire while equipped via
//   the source-agnostic engine/hooks/ collector and runners.

import type { AbilityId, BucketId, StatusTypeId } from '../../types/index.ts';
import type { PassiveHookRegistration } from '../../abilities/hooks.ts';

interface AbilityCommon {
  readonly id: AbilityId;
  readonly name: string;
  // The bucket this ability is priced against. For passives, this
  // determines which Passive bucket it equips into. For actives, it
  // identifies its slot category (first_action vs second_action) for
  // future cost-accounting needs.
  readonly bucket: BucketId;
  // Pre-modifier base cost. Per-character cost (`getCost`) may reduce
  // this to 0 via class grants or other modulations.
  readonly baseCost: number;
}

// Ranged targeting modes. `melee` requires only inRange; `straight_line`
// adds a line-of-sight check; `arc` adds the arc-targetability (uncovered
// source + target) check. See map-and-battlefield.md ("Targeting modes").
export type RangeMode = 'melee' | 'straight_line' | 'arc';

export interface AbilityRange {
  readonly horizontal: number;
  readonly vertical: number;
  // Optional — defaults to the ruleset's `rangeDefaults.minHorizontal`.
  // Set on artillery / ranged-only abilities that can't fire too close.
  readonly minHorizontal?: number;
}

// Targeting specification — what the ability needs to be aimed at and
// how its target is validated. v1 covers the two modes session 7 needs:
// `self` (no target argument) and `single_unit` (target is a unit, with
// range + range-mode validation). AoE / multi-target / tile-targeting
// land additively when their content consumers do.
export type TargetingSpec =
  | { readonly kind: 'self' }
  | {
      readonly kind: 'single_unit';
      readonly range: AbilityRange;
      readonly rangeMode: RangeMode;
    };

// Status-application sub-effect — what status is applied, to whom, with
// what magnitude/duration. Session 7's UseAbility resolver iterates these
// and calls into `applyStatus`. `target` selects the unit to receive the
// status — for `'caster'`, always the actor; for `'primary_target'`, the
// action's `targetUnitId`. AoE selectors (e.g., `'all_in_aoe'`) land with
// AoE targeting.
export interface StatusEffectSpec {
  readonly typeId: StatusTypeId;
  readonly target: 'caster' | 'primary_target';
  // Override the type's defaultMagnitude. Omitted → use default.
  readonly magnitude?: number;
  // Required when the status type's durationMode is duration-counted
  // (per_unit_ct, global_ticks, turn_based). Omitted for permanent /
  // conditional types — applyStatus throws otherwise.
  readonly duration?: number;
  // Per-instance custom state (e.g., the Charging status's chargedActionId).
  readonly customState?: Readonly<Record<string, unknown>>;
}

// Damage spec — placeholder shape for session 7. Session 8 fleshes this
// out with the seven-stage pipeline's input shape (PA/MA/WP, formula
// references, variance bands, tag set used for resistance lookups).
// Session 7 only needs enough that abilities can *declare* they do
// damage; the UseAbility reducer ignores this field until session 8.
export interface DamageSpec {
  readonly tags: ReadonlyArray<string>;
}

export interface AbilityEffects {
  readonly statusEffects?: ReadonlyArray<StatusEffectSpec>;
  // `damage` is wired up session 8; declaring it on an ability today is
  // valid metadata that doesn't drive any reducer behavior yet.
  readonly damage?: DamageSpec;
}

export interface ActiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'active';
  readonly targeting: TargetingSpec;
  // CT charge cost. 0 = instant (resolves immediately on UseAbility);
  // > 0 = creates a ChargedAction with this initial CT-shaped charge
  // time and pairs a Charging status onto the caster. Session 7 wires
  // the chargeTicks: 0 path; chargeTicks > 0 lands its full plumbing
  // when the first content consumer ships.
  readonly chargeTicks: number;
  readonly mpCost: number;
  readonly effects: AbilityEffects;
}

export interface PassiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'passive';
  readonly hooks: ReadonlyArray<PassiveHookRegistration>;
}

export type AbilityDefinition = ActiveAbilityDefinition | PassiveAbilityDefinition;
