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

import type {
  AbilityId,
  AoeShape,
  BucketId,
  DamageTag,
  StatusTypeId,
} from '../../types/index.ts';
import type { PassiveHookRegistration } from '../../abilities/hooks.ts';
import type { ReactionAbilityFields } from '../../abilities/reaction-compiler.ts';

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
  // Optional tags for category-based interactions (Silence blocking
  // 'voice'-tagged actions, Fire Mage Support adding Burn to all
  // 'magical'-tagged hits, etc.). Open string union — adding a new tag
  // is content work. The first consumer ships in session 16 (Silence's
  // 'voice' gating); the field is here in 13.7 so spec and engine align.
  readonly tags?: ReadonlyArray<string>;
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
// how its target is validated. Three kinds:
//
//   'self'        — no target argument; the ability targets the actor.
//   'single_unit' — target is a unit; range + rangeMode gate validation.
//   'tile'        — target is a tile (Position); range + rangeMode gate
//                   validation. AoE-anchored and tile-anchored single-
//                   target abilities use this kind. Type added 13.7;
//                   validation lands in session 15 (charged tile-AoE)
//                   and the AoE per-target dispatch lands in session 17.
//                   `validateAction` throws "tile target not yet
//                   implemented" until those consumers ship.
export type TargetingSpec =
  | { readonly kind: 'self' }
  | {
      readonly kind: 'single_unit';
      readonly range: AbilityRange;
      readonly rangeMode: RangeMode;
    }
  | {
      readonly kind: 'tile';
      readonly range: AbilityRange;
      readonly rangeMode: RangeMode;
    };

// Per-ability factor selection for the status application formula.
// Per ADR-0028, abilities can opt in to which stat factors compose into
// the chance. Default (when `factors` is omitted on a StatusEffectSpec)
// is `{ faith: true, ma: true }` — preserves the BMG-canonical Earth
// Magic shape. Stasis Sword sets `{ brave: true, ma: true }` for a
// hybrid Knight build. Future PA-based abilities set `pa: true`; the
// formula throws `NotYetImplementedError` until a PA-using consumer
// ships.
//
// Resistance and `modifyStatusApplicationChance` modifiers compose
// unconditionally — they're outside the factor-selection model.
export interface StatusFormulaFactors {
  readonly faith?: boolean;
  readonly brave?: boolean;
  readonly ma?: boolean;
  readonly pa?: boolean;
}

// Status-application sub-effect — what status is applied, to whom, with
// what magnitude/duration. Session 7's UseAbility resolver iterates these
// and calls into `applyStatus`. `target` selects the unit to receive the
// status — for `'caster'`, always the actor; for `'primary_target'`, the
// action's `targetUnitId`. AoE selectors (e.g., `'all_in_aoe'`) land with
// AoE targeting.
export interface StatusEffectSpec {
  readonly typeId: StatusTypeId;
  readonly target: 'caster' | 'primary_target';
  // Application chance — the `base_chance` term in the BMG status
  // application formula:
  //   hit_chance = base_chance × Faith_factor × MA_factor
  //              × (1 - target_resistance/100) × ∏modifiers
  // Expressed as [0, 100]. Omit → 100% (always applies, modulo Faith /
  // MA / resistance / modifiers). v1 ranges per BMG: a reliable
  // applier ~70%, a coin-flip 50%, a "lucky shot" 30%.
  readonly baseChance?: number;
  // When `true`, the formula short-circuits — the status applies
  // unconditionally (resistance, factors, and base chance are all
  // bypassed). The `modifyStatusApplicationChance` chain still runs in
  // case a future hook wants to gate even applyAlways effects. Per
  // ADR-0028; first consumer is Taunt.
  readonly applyAlways?: boolean;
  // Per-effect factor selection for the BMG status application formula.
  // When omitted, defaults to `{ faith: true, ma: true }`. Per
  // ADR-0028.
  readonly factors?: StatusFormulaFactors;
  // Override the type's defaultMagnitude. Omitted → use default.
  readonly magnitude?: number;
  // Required when the status type's durationMode is duration-counted
  // (per_unit_ct, global_ticks, turn_based). Omitted for permanent /
  // conditional types — applyStatus throws otherwise.
  readonly duration?: number;
  // Per-instance custom state (e.g., the Charging status's chargedActionId).
  readonly customState?: Readonly<Record<string, unknown>>;
  // Per ADR-0030: how many stacks this application requests. Defaults
  // to 1. Spark applies 2 (Burn-bomb pattern). For statuses whose type
  // defines `composeApplyState`, this is forwarded as
  // `requestedStackQuantity` — Burn snapshots N copies of MA × coefficient
  // into its per-stack damage array.
  readonly stackQuantity?: number;
  // Per session 19: when true, this effect's chance roll is *linked*
  // to the previous effect's outcome — both apply or both miss as a
  // unit. Implementation: the resolver shares the previous effect's
  // effectIndex so `rollStatusChance` produces the same `roll` value;
  // when both effects also have identical chance computations
  // (matching baseChance, factors, and resistance tag against the same
  // target), the `applied` outcome is identical too.
  //
  // First consumer is Fire Strike (linked PA Down + MA Down debuff)
  // and Fire Embrace (linked PA Up + MA Up buff) — Fire's identity is
  // "all-or-nothing stat shift," distinct from Earth Curse's
  // independent-rolls feel. Ignored on the first effect of an ability
  // (no previous effect to link to); content authors can mark either
  // effect — the resolver normalizes.
  readonly linkRoll?: boolean;
}

// Hit-determination spec for physical attacks. Per the ability format
// spec, the *presence* of `hitRoll` on an ActiveAbilityDefinition means
// "this ability rolls to hit"; absence means auto-hit. Magical-only
// damage skips the roll regardless of the field's presence (the
// evasion_check pipeline handler short-circuits on missing `'physical'`).
//
// `accuracy` is the weapon-accuracy term in the formula
// `hit_chance = weapon_accuracy × (1 − target_evasion[facing] / 100) ×
// elevation_modifier × hit_modifiers` (see docs/battle-mechanics-guide.md
// "Hit chance — physical attacks"). The Battle Mechanics Guide lists
// realistic values per weapon in the [85, 100] range and documents the
// "no weapon / unarmed → 100" default.
//
// v1 placeholder: equipment integration is deferred to session 17 per
// ADR-0014, so there is no equipped weapon to read accuracy from. Until
// then, abilities author `accuracy` directly. Default at the handler is
// 100. When session 17 lands, weapon-sourced accuracy replaces this
// per-ability override and `accuracy` becomes the optional override only.
export interface HitRollSpec {
  readonly accuracy?: number;
}

// Damage spec — input to the seven-stage damage pipeline. The base
// stage handlers read `power_coefficient` and the tag set to compute
// baseDamage (e.g., 'physical' → PA × WP × power_coefficient; 'magical'
// / 'healing' → MA × power_coefficient × Faith_factor). Variance is the
// [min, max] multiplier band for the variance stage; omitted → pipeline
// default (no variance).
//
// `tags` is the set used both for handler dispatch (each base handler
// gates on a specific tag) and for resistance / immunity lookups.
// Authors list every tag that applies; the pipeline composes. The
// `'weapon'` tag triggers weapon-tag composition per ADR-0028: the
// equipped weapon's `tags` merge into the resolved damage tags so a
// fire-imbued sword carries `'fire'` into resistance lookups without
// per-ability re-declaration.
export interface DamageSpec {
  readonly tags: ReadonlyArray<DamageTag>;
  // Per-ability scalar fed into the base formula. For 'physical', this
  // is the ability's portion of the weapon × ability product
  // (`PA × WP × power_coefficient`); for 'magical' / 'healing', the
  // spell multiplier (`MA × power_coefficient × Faith_factor`).
  // Renamed from `power` per ADR-0028 — the field's meaning changed
  // (combined WP × coefficient → just the coefficient) when WP became
  // weapon-sourced. Defaults to 1 in each base handler when omitted.
  readonly power_coefficient?: number;
  // Variance band as [min, max] on the unit-multiplier scale. Omitted
  // → use the pipeline default (no variance, i.e., { min: 1, max: 1 }).
  readonly variance?: { readonly min: number; readonly max: number };
  // CT-push damage rider — deterministic on-hit CT adjustment. When set,
  // a successful damage application emits a `system_ct_push` against the
  // target with `delta = -floor(factor × caster.MA)` (signed: a positive
  // factor pushes CT *back*, since it's a debuff rider). Fires only on
  // hit and only when damage was actually dealt; skipped on miss /
  // healing / KO. Per session 18 (Water Mage). Caster MA reads through
  // `runModifyStatQuery` so equipment / status MA modifiers compose.
  readonly ctPush?: { readonly factor: number };
  // Knockback damage rider — forced movement of the target. When set,
  // a successful damage application optionally rolls a chance-gate then
  // calls the `applyKnockback` primitive (per ADR-0026). Direction is
  // uniform across all targets of an AoE: cardinal vector from the
  // caster's tile toward the original payload target's position.
  //
  // `chance` undefined → fires deterministically (always knocks back,
  // modulo collision). `chance` set → rolls a Faith × MA × resistance
  // gate (same pipeline as status applications) before firing; per-
  // target independent rolls in AoE.
  //
  // Falling damage from elevation drops (per ADR-0026) is forwarded as
  // a `system_damage` emission onto the action chain.
  readonly knockback?: {
    readonly distance: number;
    readonly chance?: number;
    readonly factors?: StatusFormulaFactors;
  };
  // Chain damage rider — scales effective `power_coefficient` with the
  // number of targets hit. Per ADR-0032, the base-stage handler
  // (`magical_ma_power` / `physical_pa_wp`) folds in
  // `power_coefficient + powerPerAdditionalTarget × max(0, targetCount - 1)`
  // — every target in the cluster sees the boosted scalar uniformly.
  // First v1 consumer is Chain Lightning (Lightning Mage AoE):
  // base power 8, chainBonus { powerPerAdditionalTarget: 1 } → 1
  // target = 8, 2 = 9, 3 = 10, etc. Cluster size is read from the
  // pipeline's `ctx.targetCount`, threaded by the dispatcher.
  readonly chainBonus?: { readonly powerPerAdditionalTarget: number };
}

// Free-standing CT effect — chance-gated CT adjustment with no damage
// component. First v1 consumer is Tide Surge (Water Mage Buff): Faith-
// chance roll applies +floor(factor × MA) to an ally's CT. Distinct
// from `damage.ctPush` (which is a deterministic on-hit rider on a
// damage effect) — `ctEffects` runs through the status-application
// chance pipeline (Faith × MA × resistance × modifiers) and then emits
// `system_ct_push` on success.
//
// `factor` is signed: `+2` for an ally-bump, `-2` for an enemy-push.
// `target: 'caster'` and `'primary_target'` parallel `StatusEffectSpec`.
//
// Resistance is not currently consulted (CT effects don't have a
// resistance tag); the chance formula is `baseChance × ∏factors` clamped
// to [0, 1]. If a future content consumer needs CT-specific resistance,
// this shape extends.
export interface CtEffectSpec {
  readonly target: 'caster' | 'primary_target';
  readonly factor: number;
  readonly baseChance?: number;
  readonly factors?: StatusFormulaFactors;
}

// Area-of-effect spec — when set, `resolveAbilityTargets` expands the
// declared anchor (target unit's position or target tile) into the
// shape's footprint, and dispatches `resolveAbilityEffect` per affected
// unit. Per-target seed branching makes each affected unit's variance,
// evasion, status, and Brave-reaction rolls independent (see
// `perTargetSeed` in engine/actions/seed.ts).
//
// Optional fields:
// - `verticalTolerance` — overrides the ruleset's
//   `rangeDefaults.aoeVerticalTolerance` (v1 default: 1) for this
//   ability. Tiles whose elevation differs from the anchor's by more
//   than this value are excluded from the footprint per the design's
//   multi-layer-affected default in map-and-battlefield.md.
// - `excludeCaster` — when true (the FFT-canonical default), the
//   caster never appears in the affected unit set even if they stand
//   in the footprint. Set to `false` for self-centered AoEs that
//   should also affect the caster (e.g., a sacrificial nova). v1
//   content uses the default.
//
// Friendly fire is governed by `ruleset.behaviors.friendlyFire` (v1
// default: true). When false, units on the caster's team are excluded
// from the affected set; when true, they're included. The flag lives
// on the ruleset (not on the AoE spec) because it's a global mode
// rather than a per-ability decision.
//
// `anchorMode` selects where the AoE blooms:
// - `'target'` (default): the AoE expands from the targeted tile / unit's
//   position. The classic shape — Earth Quake, Earth Cataclysm, fireballs.
// - `'caster'`: the AoE expands from the caster's current position.
//   Directional shapes (cone) require this mode — the picked target tile
//   is used only to derive the cone's facing direction. First v1
//   consumer is Maelstrom (Water Mage Ultimate).
export type AoeAnchorMode = 'target' | 'caster';

export interface AoeSpec {
  readonly shape: AoeShape;
  readonly verticalTolerance?: number;
  readonly excludeCaster?: boolean;
  readonly anchorMode?: AoeAnchorMode;
}

export interface AbilityEffects {
  readonly statusEffects?: ReadonlyArray<StatusEffectSpec>;
  // Free-standing CT effects (per session 18). Each entry runs through
  // the status-application chance pipeline (Faith × MA × resistance ×
  // modifiers) and emits `system_ct_push` on success. Distinct from
  // `damage.ctPush`, which is a deterministic on-hit rider on a damage
  // effect — `ctEffects` is the standalone version used by abilities
  // with no damage component (Tide Surge).
  readonly ctEffects?: ReadonlyArray<CtEffectSpec>;
  // `damage` is wired up session 8; declaring it on an ability today is
  // valid metadata that doesn't drive any reducer behavior yet.
  readonly damage?: DamageSpec;
  // AoE — when present, the ability resolves against multiple targets
  // (the anchor expanded by `shape`); when absent, the ability resolves
  // against the single targeted unit (or self / tile-anchored single
  // unit). Per-target seed branching is automatic — see `AoeSpec`.
  // Wired up session 17. AoE without `damage` or `statusEffects` is
  // a no-op and rejected by the dispatcher (a future use case might
  // be a pure-knockback AoE; that surface lands when the consumer ships).
  readonly aoe?: AoeSpec;
}

export interface ActiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'active';
  readonly targeting: TargetingSpec;
  // Action Speed — the rate at which the spawned ChargedAction
  // accumulates CT each tick (see docs/design/ct-system.md). 0 = instant
  // (resolves immediately on UseAbility); > 0 = creates a ChargedAction
  // with `ct: 0, speed: actionSpeed` and pairs a Charging status onto
  // the caster. Session 7 wires the actionSpeed: 0 path; the > 0 path
  // lands its full plumbing in session 15 alongside ChargedAction.
  readonly actionSpeed: number;
  readonly mpCost: number;
  // Hit-determination spec for physical attacks. Absent → auto-hit
  // (the convention: omit for "no roll"). Present → physical hit chance
  // applies per docs/battle-mechanics-guide.md "Hit chance — physical
  // attacks", read by the evasion_check pipeline handler. Magical-only
  // abilities skip the roll regardless. See ADR-0019.
  readonly hitRoll?: HitRollSpec;
  readonly effects: AbilityEffects;
  // Per-cast self-damage cost (per ADR-0032). When set, the dispatcher
  // emits a `system_damage` against the caster after the per-target
  // dispatch completes, with `amount = floor(fraction × caster.maxHpBase)`
  // and source `{ kind: 'ability_self_cost', abilityId }`. Fires once
  // per cast, regardless of cluster size, hit, or KO of any target.
  // Bypasses the seven-stage damage pipeline entirely (no resistance,
  // no reactions, no Vulnerable amplification — it's a cost, not a hit).
  // First v1 consumer is Lightning Mage's Storm Caller (Ultimate):
  // `selfDamage: { fraction: 0.25 }` — 25% of the caster's max HP.
  // The discrete `system_damage` emission with the labeled source is
  // the avenue Chris reserved for a future item/ability that prevents
  // self-cost: a preventer registers an `onActionAttempted` handler
  // that matches on `action.payload.source.kind === 'ability_self_cost'`
  // and returns `blocked`.
  readonly selfDamage?: { readonly fraction: number };
}

export interface PassiveAbilityDefinition extends AbilityCommon {
  readonly kind: 'passive';
  readonly hooks: ReadonlyArray<PassiveHookRegistration>;
  // Decorative metadata for reaction passives. Populated by
  // `compileReactionAbility` (which bundles `compileReaction` with this
  // decoration), this field exposes the reaction's declarative source
  // — `triggerOn`, `triggerCondition`, `effects` — so consumers like
  // the AI can reason about whether the reaction would fire against a
  // given proposed action without invoking the compiled hooks.
  //
  // Per ADR-00X (session 20b): the AI's `reactionPenalty` reads this
  // field's `triggerCondition.damageTagsAny` / `damageTagsNone` to
  // narrow penalties to reactions that would actually fire. Reactions
  // built via `compileReaction` directly (rather than the bundled
  // helper) lack this decoration and the AI treats them as
  // always-firing (safe default).
  readonly reactionFields?: ReactionAbilityFields;
}

export type AbilityDefinition = ActiveAbilityDefinition | PassiveAbilityDefinition;
