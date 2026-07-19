// Action — the unit of state transition in the engine.
// See docs/design/core-types.md ("Action") and
// docs/design/action-resolution.md.
//
// The session-1 skeleton (universal envelope + open `payload` /
// `outcome`) was filled in by session 7: each `type` discriminant pairs
// with its specific payload and outcome shape. The `Action` type is a
// discriminated union over those pairs; the universal envelope (seq #,
// seed, source, chain bookkeeping) lives in `ActionEnvelope` and is
// intersected onto every variant.
//
// Adding a new action kind is one entry in the union plus a reducer
// branch and (where applicable) a validator clause.

import type { DamageTag } from './damage.ts';
import type { AbilityId, ChargedActionId, ItemId, StatusTypeId, TeamId, UnitId } from './ids.ts';
import type { Direction, Position } from './spatial.ts';
import type { StatusApplicationOutcome } from './status-application-outcome.ts';
import type { BarrierState, TerrainType } from './tile.ts';

export type ActionType =
  | 'move'
  | 'use_ability'
  | 'use_compound'
  | 'use_throw_item'
  | 'wait'
  | 'set_facing'
  | 'turn_start'
  | 'turn_end'
  | 'charged_action_resolve'
  | 'status_tick'
  | 'system_heal'
  | 'system_damage'
  | 'system_mp_restore'
  | 'system_mp_drain'
  | 'system_apply_status'
  | 'system_ct_push'
  | 'system_cover_redirect'
  | 'system_set_ct'
  | 'system_ko_tick'
  | 'system_xp_award'
  | 'system_unit_removed'
  | 'system_terrain_change'
  | 'system_barrier_change'
  | 'system_barrier_damage'
  | 'system_bridge_destroy'
  | 'status_remove'
  | 'status_decrement_stack'
  | 'battle_end';

export type ActionSource = 'player' | 'system';

// Session 49: Math Skill targeting parameter — picks which numeric
// property of each candidate unit the predicate inspects. The four
// canonical FFT-style parameters cover dynamic (CT, current HP) and
// static (Height, Level) axes.
// TABA: `xp` is a Thessaly-exclusive parameter (a unit-restricted Math
// component) — targets read off `Unit.xp`. It extends the closed set; it is only
// ever *buyable* by Thessaly (Seam 3), but the literal must live in the union so
// the picker + evaluator can handle it.
export type MathSkillParameter = 'ct' | 'height' | 'level' | 'current_hp' | 'xp';

// Session 49: Math Skill value — the test the parameter is checked
// against. `'prime'` selects units whose parameter is a prime number;
// the numeric values select units whose parameter is divisible by N.
//
// The 4 × 4 grid (parameter × value) generates the 16 combinations a
// Calculator picks among per Math cast. Future expansions (more
// parameters or more divisors) extend the union; the engine's
// predicate enumerator handles every (param, value) pair uniformly.
// TABA: `'square'` is a Thessaly-exclusive value (a unit-restricted Math
// component) — selects units whose parameter is a perfect square (1, 4, 9, 16,
// 25, …). With `xp` it lifts her lattice from the base 4×4 to 5×5. Only ever
// buyable by Thessaly (Seam 3); the literal lives in the union for the picker +
// evaluator.
export type MathSkillValue = 'prime' | 'square' | 3 | 4 | 5;

// What target an ability action is aimed at. `self` for `targeting.kind:
// 'self'` abilities; `unit` for single-unit targeting; `tile` for
// tile-anchored targeting (resolves at the position regardless of which
// unit is there at resolution time — FFT location-deterministic
// behavior). AoE per-target dispatch lands additively in session 17;
// per-target results for AoE / tile-anchored damage are still
// unit-keyed.
//
// Session 49: `math_skill` carries the cast-time parameter + value the
// controller picked. The engine enumerates matching units at resolve
// time via the predicate; per-target dispatch runs through the same
// `resolveAbilityEffect` body as AoE — no targeting-specific resolution
// branch.
export type AbilityTarget =
  | { readonly kind: 'self' }
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'tile'; readonly position: Position }
  // Session 54: a contiguous set of tiles picked as one target — the
  // Terraformer's Worldcraft Barrier ability (a 3-5 tile straight line).
  // The player picks an orientation + length in the UI; the resolved
  // tile positions ride here. Validation (the `tile_set` targeting kind)
  // enforces contiguity, a straight orientation, length bounds, range,
  // and (for barrier placement) unoccupied/barrier-free tiles.
  | { readonly kind: 'tile_set'; readonly positions: ReadonlyArray<Position> }
  | {
      readonly kind: 'math_skill';
      readonly parameter: MathSkillParameter;
      readonly value: MathSkillValue;
    }
  // Session 76: grapple-throw (the Monk's Bear's Heave) — grab a unit and
  // place it on a chosen destination tile. `unitId` is the throwee;
  // `destination` is the tile to set them on (validated within the throw
  // radius of the throwee's current position by the `grapple_throw`
  // targeting kind).
  | {
      readonly kind: 'grapple_throw';
      readonly unitId: UnitId;
      readonly destination: Position;
    };

// Per-target result inside a UseAbility outcome. Damage is populated
// session 8; v1 records hits and per-target status-application outcomes.
export interface AbilityTargetResult {
  readonly target: AbilityTarget;
  readonly hit: boolean;
  readonly damage?: number;
  readonly healing?: number;
  // True when the healing was produced by absorption rather than a
  // natively-healing ability (per ADR-0057, Session 27). Lets the action
  // log distinguish "absorbed X HP" from "healed X HP"; the AbilityTarget
  // formatter chooses wording based on this flag. Absent for native
  // damage / native heal results.
  readonly absorbed?: boolean;
  readonly statusesApplied?: ReadonlyArray<StatusApplicationOutcome>;
  // Session 31.5: when a knockback rider on the ability displaced this
  // (unit-kind) target, the new position is recorded here so the
  // renderer can settle its snap to the destination at flash finalize.
  // Pre-31.5 the engine updated unit.position inline (the engine state
  // tracked the displacement correctly — clicking the new tile opened
  // the unit's detail panel) but no animator event carried it, so the
  // sprite stayed on the original tile until that unit's next Move.
  readonly displacedTo?: Position;
  // Session 33.5 (ADR-0074): the unit-kind target's actual HP after this
  // result's HP application committed to engine state. `damage` /
  // `healing` are the *computed* magnitudes (what the action log shows);
  // `hpAfter` is the *applied* truth. They diverge when the engine gates
  // an application — e.g. a healing-tagged hit on a KO'd target records
  // `healing: 35` but applies nothing, so `hpAfter` stays 0. The renderer
  // settles its visual HP/KO from `hpAfter` rather than re-deriving it by
  // arithmetic on a drifting snapshot. Absent for tile-kind targets.
  readonly hpAfter?: number;
}

// === Per-action payload + outcome pairs ===

export interface MovePayload {
  readonly destination: Position;
}
export interface MoveOutcome {
  readonly kind: 'move';
  readonly pathTaken: ReadonlyArray<Position>;
  readonly finalPosition: Position;
  readonly facingAfter: Direction;
}

// Per ADR-0064 (Session 30): rider provenance for ability casts that are
// fired by equipment rather than chosen by the wielder. When present, the
// reducer treats the cast as a weapon's power, not the unit's: MP is not
// deducted, `onActionAttempted` veto handlers (Silence on `'magical'`,
// Don't Act on volitional casts) are bypassed, and the action log can
// attribute the cast to the source item. v1 producer: weapon `attackProcs`
// (Bolt Hammer, Flametongue's Burn proc, etc., authored in Session 31).
export type UseAbilityRiderSource = {
  readonly kind: 'equipment_proc';
  readonly itemId: ItemId;
};

export interface UseAbilityPayload {
  readonly abilityId: AbilityId;
  readonly target: AbilityTarget;
  readonly riderSource?: UseAbilityRiderSource;
}
export interface UseAbilityOutcome {
  readonly kind: 'use_ability';
  readonly abilityId: AbilityId;
  readonly perTargetResults: ReadonlyArray<AbilityTargetResult>;
  readonly mpSpent: number;
  // Session 33.5A (ADR-0074 amendment): the caster's actual MP after the
  // cast committed. `mpSpent` is the *computed* cost (what the action log
  // shows); `mpAfter` is the *applied* truth — the renderer settles its
  // MP bar from this absolute rather than `snap.mp - mpSpent` arithmetic
  // on a drifting snapshot. Present on both the instant-cast path and the
  // charged-cast commit (which deducts MP up front). Absent for rider
  // casts that spend no MP (the snapshot doesn't move).
  readonly mpAfter?: number;
  // When actionSpeed > 0, the UseAbility commit creates a ChargedAction
  // and applies the Charging status; the actual effect resolution
  // happens later via `charged_action_resolve`.
  readonly chargedActionId?: ChargedActionId;
  // Session 45: when the ability is a caster-reposition (`effects.selfMove`,
  // the Hunter's Scramble), the caster's `[from, to]` hop path and the
  // facing it settles into. The renderer plays this as a `move`-kind
  // animation so the sprite walks to the destination rather than jumping
  // there (the same gap `displacedTo` closed for knockback). Absent on
  // every non-selfMove cast.
  readonly casterMove?: {
    readonly path: ReadonlyArray<Position>;
    readonly facingAfter: Direction;
  };
}

export interface WaitPayload {
  readonly _empty?: never;
}
export interface WaitOutcome {
  readonly kind: 'wait';
}

// Session 39a: Compound — Alchemist banks one of the selected item type
// into their stockpile, paying the item's `compoundMpCost`. Self-
// targeted; 100% accuracy. The action is the unit's standard action
// turn (not instant). Validation gates on MP sufficiency.
export interface UseCompoundPayload {
  readonly itemId: ItemId;
}
export interface UseCompoundOutcome {
  readonly kind: 'use_compound';
  readonly itemId: ItemId;
  readonly mpSpent: number;
  // ADR-0074 absolute: the caster's MP after the cost committed; lets
  // the UI / log settle from engine truth rather than re-deriving.
  readonly mpAfter: number;
  // Stockpile count for `itemId` after the increment, for action-log
  // attribution ("Beowulf prepared a Potion (2 on hand)").
  readonly stockpileAfter: number;
}

// Session 39a: Throw Item — Alchemist consumes one of the selected item
// from their stockpile and applies its effects to the target. 100%
// accuracy; range 3 horizontal × 3 vertical with LoS (per the brief).
// KO'd targets are valid targets so Phoenix Down can revive; the
// non-revival items naturally apply their gated zero (heal on KO'd → 0,
// status clear on KO'd → no-op).
export interface UseThrowItemPayload {
  readonly itemId: ItemId;
  readonly target: AbilityTarget;
}
export interface UseThrowItemOutcome {
  readonly kind: 'use_throw_item';
  readonly itemId: ItemId;
  readonly target: AbilityTarget;
  // Mirror of UseAbilityOutcome.perTargetResults so the action-log and
  // renderer can reuse the same settle machinery. Throw Item is single-
  // target in v1 (1-element array); the array shape leaves room for a
  // future Throw-AoE item without a payload-shape break.
  readonly perTargetResults: ReadonlyArray<AbilityTargetResult>;
  // Stockpile count for `itemId` after the decrement.
  readonly stockpileAfter: number;
}

export interface SetFacingPayload {
  readonly facing: Direction;
}
export interface SetFacingOutcome {
  readonly kind: 'set_facing';
  readonly from: Direction;
  readonly to: Direction;
}

export interface TurnStartPayload {
  readonly unitId: UnitId;
}
export interface TurnStartOutcome {
  readonly kind: 'turn_start';
  readonly unitId: UnitId;
  readonly skipped: boolean;
  readonly skipReason?: string;
}

export interface TurnEndPayload {
  readonly unitId: UnitId;
}
export interface TurnEndOutcome {
  readonly kind: 'turn_end';
  readonly unitId: UnitId;
  readonly ctSpent: number;
}

export interface ChargedActionResolvePayload {
  readonly chargedActionId: ChargedActionId;
}
export interface ChargedActionResolveOutcome {
  readonly kind: 'charged_action_resolve';
  readonly chargedActionId: ChargedActionId;
  readonly perTargetResults: ReadonlyArray<AbilityTargetResult>;
  // Session 33.5A (ADR-0074 amendment): the caster's MP after the resolve
  // committed. A charged cast's MP is deducted at the `use_ability` commit
  // (not here), so at resolve `mpAfter` is the *unchanged* current value —
  // it keeps the renderer's MP snapshot anchored to engine truth without
  // re-deriving. Absent when the caster KO'd / left state before resolve.
  readonly mpAfter?: number;
}

export interface StatusTickPayload {
  readonly unitId: UnitId;
  readonly statusTypeId: StatusTypeId;
}
export interface StatusTickOutcome {
  readonly kind: 'status_tick';
  readonly unitId: UnitId;
  readonly statusTypeId: StatusTypeId;
  readonly removed: boolean;
}

// `system_heal` — engine-emitted heal-the-target action used by
// onTick handlers (Regen) and other status side effects. Distinct from
// healing-tagged use_ability because it has no caster / ability /
// reaction surface — it's a pure HP modification driven by a status
// in flight. Per ADR-0024.
//
// `amount` is precomputed by the emitting handler (Regen reads MaxHP and
// Faith via runModifyStatQuery, computes (Faith/100) × 0.10 × MaxHP, and
// emits the rounded amount). The reducer applies the floor at MaxHP and
// records the actual delta.
export interface SystemHealPayload {
  readonly targetId: UnitId;
  readonly amount: number;
  readonly tags: ReadonlyArray<DamageTag>;
  readonly source: SystemHealSource;
}
export interface SystemHealOutcome {
  readonly kind: 'system_heal';
  readonly targetId: UnitId;
  readonly amount: number;
  readonly applied: number; // post-cap-at-maxHp delta
  // Session 33.5A (ADR-0074 amendment): the target's actual HP after this
  // heal committed. `applied` is the delta (action-log magnitude); this is
  // the applied absolute the renderer / KO walker anchor to. Populated on
  // every path including the gated ones (KO'd target, applied: 0) with the
  // unchanged value. Absent only when the target isn't in state.
  readonly hpAfter?: number;
}
// Provenance for a system_heal — which subsystem emitted it. Lets the
// log (and a future debug overlay) trace "this 4 HP came from Regen,
// not from a Cure ability." StatusType-anchored emissions name the
// type id; future broader sources add new variants.
//
// Session 39b: `movement_passive` covers heals emitted from
// `onMoveCompleted` (Field Recovery's tiles²). Action-log attribution
// reads the abilityId for "Field Recovery healed Beowulf for 16 HP."
export type SystemHealSource =
  | { readonly kind: 'status_tick'; readonly statusTypeId: StatusTypeId; readonly unitId: UnitId }
  | { readonly kind: 'movement_passive'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  // Session 53: Damage Split heals the reactor for half the damage it took,
  // paired with the `'reflect'` system_damage to the attacker. `abilityId`
  // names the reaction; `unitId` is the reactor (the heal target).
  | { readonly kind: 'reaction'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  // Thief — Steal HP lifesteal. A damaging active siphons a fraction of the
  // HP it dealt back to the caster. `abilityId` names the active; `unitId`
  // is the caster (the heal target).
  | { readonly kind: 'ability'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  // TABA M3 (Star Robe): equipment-sourced lifesteal — the wearer heals
  // a percentage of matching (tag-gated) damage they deal, fired from
  // the wearer's `onFinalDamage` hook. `unitId` is the wearer.
  | { readonly kind: 'equipment_lifesteal'; readonly itemId: ItemId; readonly unitId: UnitId };

// `system_damage` — engine-emitted damage-the-target action used by
// onTick handlers (Poison) and ADR-0026 falling damage. Symmetric to
// `system_heal`. Bypasses the seven-stage damage pipeline (no variance,
// no Faith, no resistance, no Counter trigger). Per ADR-0027.
//
// `amount` is precomputed by the emitting handler (Poison computes
// floor(MaxHP × 0.10) via runModifyStatQuery; falling damage computes
// 10 × dropDistance per ADR-0026). The reducer floors HP at 0 and
// records the actual delta.
export interface SystemDamagePayload {
  readonly targetId: UnitId;
  readonly amount: number;
  readonly tags: ReadonlyArray<DamageTag>;
  readonly source: SystemDamageSource;
}
export interface SystemDamageOutcome {
  readonly kind: 'system_damage';
  readonly targetId: UnitId;
  readonly amount: number;
  readonly applied: number; // post-floor-at-0 delta
  // Session 33.5A (ADR-0074 amendment): the target's actual HP after this
  // damage committed. `applied` is the delta (action-log magnitude); this
  // is the applied absolute the renderer / KO walker anchor to — it is
  // engine-clamped at 0, so an overkill tick reports `hpAfter: 0`.
  // Populated on every path including gated ones (KO'd target, applied: 0)
  // with the unchanged value. Absent only when the target isn't in state.
  readonly hpAfter?: number;
}
// Provenance for a system_damage. `status_tick` covers Poison; `falling`
// covers ADR-0026 forced-movement landing damage; `ability_self_cost`
// (added session 20 per ADR-0032) covers per-cast self-damage costs
// like Lightning Mage's Storm Caller. Future variants extend the union
// (environmental hazards, equipment thorns, etc.).
export type SystemDamageSource =
  | { readonly kind: 'status_tick'; readonly statusTypeId: StatusTypeId; readonly unitId: UnitId }
  | { readonly kind: 'falling'; readonly unitId: UnitId; readonly dropDistance: number }
  | { readonly kind: 'ability_self_cost'; readonly abilityId: AbilityId; readonly casterId: UnitId }
  // Session 37: Spiked Mail (and future reflective gear) emits a
  // `system_damage` back at the attacker, sourced from `onFinalDamageReceived`.
  // `wearerId` is the equipment wearer (the original target); `itemId`
  // names the reflective item. The action log renders these as
  // `[revenge]`-tagged entries to distinguish reflect proc damage from
  // the wearer's own actions.
  | { readonly kind: 'revenge'; readonly wearerId: UnitId; readonly itemId: ItemId }
  // Session 53: Damage Split (Terraformer native Reaction) reflects the
  // damage it took back at the attacker as a `system_damage`, emitted from
  // `onActionTargeted` and Brave-gated by the reaction runner. Distinct
  // from `'revenge'` (passive equipment reflect, no Brave gate): `'reflect'`
  // is a Reaction-triggered bounce. `reactorId` is the reacting unit (the
  // original target); `attackerId` is the unit that gets bounced. Like all
  // system_damage it bypasses the pipeline, so the reflect can't cascade
  // into the attacker's own reactions.
  | { readonly kind: 'reflect'; readonly reactorId: UnitId; readonly attackerId: UnitId };

// Session 39a: `system_mp_restore` — engine-emitted MP write used by
// Ether (and any future MP-restore consumer). Parallel to system_heal
// (HP). Bypasses Faith / MA / resistance — items are flat-coefficient
// restores by design. Capped at `runModifyStatQuery(maxMp)` at apply
// time. KO'd targets short-circuit to applied=0 (vitals are gated
// while KO'd, matching the HP gate on system_heal).
//
// TABA Ch3: `amount` is SIGNED. Negative = a one-sided MP BURN, floored
// at 0 MP (Golden Rod's pact tick). `system_mp_drain` can't model this —
// it's a transfer, and a self-drain nets zero — and the burn stays on
// this action rather than a new discriminant to keep the ActionType
// surface closed. `applied` in the outcome carries the same sign.
export interface SystemMpRestorePayload {
  readonly targetId: UnitId;
  readonly amount: number; // requested delta: positive restore, negative burn
  readonly source: SystemMpRestoreSource;
}
export interface SystemMpRestoreOutcome {
  readonly kind: 'system_mp_restore';
  readonly targetId: UnitId;
  readonly amount: number;
  readonly applied: number; // post-cap delta
  readonly mpAfter?: number; // ADR-0074 absolute (absent if target not in state)
}
// Provenance for a system_mp_restore. v1 producers:
//   - throw_item (Ether)
//   - movement_passive (Session 49: Calculator's Thoughtful Pacing emits
//     2 × tilesMoved MP restore on each Move completion).
//   - status_tick (Session 65: the Circlet's per-turn MA/2 MP regen rides a
//     granted status's onTick, mirroring Regen's system_heal provenance).
export type SystemMpRestoreSource =
  | { readonly kind: 'throw_item'; readonly itemId: ItemId; readonly casterId: UnitId }
  | { readonly kind: 'movement_passive'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  // Session 62 (Unified Calling, ADR-0101): on receiving a one-time heal, a
  // reaction passive restores MP equal to the recipient's PA.
  | { readonly kind: 'heal_reaction'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  | { readonly kind: 'status_tick'; readonly statusTypeId: StatusTypeId; readonly unitId: UnitId }
  // Session 76: an ability's `mpRestore` effect (the Monk's Chakra) refills
  // each affected target's MP by `caster_stat × coefficient`.
  | { readonly kind: 'ability'; readonly abilityId: AbilityId; readonly casterId: UnitId };

// `system_mp_drain` — engine-emitted MP transfer used by Rasp Pendant
// (Session 31) and any future damage-to-MP-drain effects. Distinct from
// system_damage / system_heal because the resource moved is MP, not HP,
// and the action models a transfer (source gains; target loses) rather
// than a one-sided write. Per ADR-0065 (Session 30).
//
// `amount` is the requested transfer in MP. The reducer applies the
// transfer-bounded math:
//   targetApplied = min(target.vitals.mp, amount)        // floor at 0
//   sourceApplied = min(maxMp(source) − source.mp, targetApplied)
// so the source never goes above maxMp, and never gains more than the
// target actually had to give. KO'd targets short-circuit to applied=0
// on both sides (matches Rasp Pendant's spec "doesn't apply to KO'd
// targets") rather than transferring; the entry is still logged for
// action-log readability.
export interface SystemMpDrainPayload {
  readonly source: UnitId;
  readonly target: UnitId;
  readonly amount: number; // requested transfer
  // Fraction of the MP *actually removed from the target* that the source
  // receives. Defaults to 1.0 (a full transfer — Rasp Pendant). The Thief's
  // Steal MP passes 0.5: the target loses the full drained amount, but the
  // Thief recovers only half (the rest is destroyed). The source's gain is
  // still capped at its MP headroom after the fraction is applied:
  //   sourceApplied = min(maxMp(source) − source.mp, floor(restoreFraction × targetApplied))
  readonly restoreFraction?: number;
}
export interface SystemMpDrainOutcome {
  readonly kind: 'system_mp_drain';
  readonly source: UnitId;
  readonly target: UnitId;
  readonly requested: number;
  readonly targetApplied: number; // MP removed from target after floor at 0
  readonly sourceApplied: number; // MP added to source after cap at maxMp
  // Session 33.5A (ADR-0074 amendment): both ends' actual MP after the
  // transfer committed. `sourceApplied` / `targetApplied` are the deltas
  // (action-log magnitudes); these are the applied absolutes the renderer
  // settles from. Both populated on every path — including the gated
  // all-zero paths (missing unit, KO'd target) — with the unchanged value
  // so the renderer never re-derives. Absent only when the unit isn't in
  // state at all (nothing to settle).
  readonly sourceMpAfter?: number;
  readonly targetMpAfter?: number;
}

// `system_apply_status` — engine-emitted action that applies a status
// to a target unit *without* running the BMG application chance formula.
// Used by the reaction compiler when a reaction's effect is "apply
// status to self/attacker" (Earth Resilience's Move/Jump self-buff
// when triggered, etc.). The triggering Brave roll has already gated
// whether the reaction fires; the application itself is deterministic.
//
// For ability-driven status applications (Earth Strike's debuff rider,
// Earth Curse's Blind+Silence), the formula path inside
// `resolveAbilityEffect` is the right entry point — that path *does*
// run Faith × MA × resistance × modifiers. Per ADR-0024.
export interface SystemApplyStatusPayload {
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
  readonly sourceUnitId: UnitId | null;
  readonly magnitude?: number;
  readonly duration?: number;
  readonly customState?: Readonly<Record<string, unknown>>;
  // Per ADR-0030: stack quantity forwarded into the type's
  // composeApplyState (Burn snapshots applier MA × coefficient N
  // times). Defaults to 1 when omitted.
  readonly stackQuantity?: number;
  // S50 fix: the source ability's `tags` array, threaded through to
  // `applyStatus` so the `modifyStatusApplicationStackCount` chain's
  // `sourceAbilityTagAll` gate fires correctly. Pre-S50 this field
  // was absent on every system_apply_status emission and the gate
  // defaulted to `[]` — Wand of Lumen's `['fire']` predicate never
  // matched when Ignition (or any other passive that emits
  // system_apply_status from a fire-tagged cast) applied the Burn,
  // so Fireball + Ignition + Wand of Lumen yielded 1 Burn stack
  // instead of the intended 2. Reaction-emitted applies (Smolder via
  // the reaction compiler) and passive-emitted applies (Ignition's
  // onDamageDealt) both populate this from their own `ctx.ability.
  // tags`; pre-battle equipment grants (Tintinibar's Auto-Regen,
  // Sorcerer's Robe's Auto-Shell) and other engine-internal emitters
  // omit it (no caster ability identity to attribute).
  readonly sourceAbilityTags?: ReadonlyArray<string>;
  // Per ADR-0071 (Session 32): provenance for the apply, in addition
  // to (sourceUnitId, sourceActionSeq) which still travel through
  // `applyStatus`. The action-log formatter reads this to render
  // attribution like "Tintinibar grants Regen". Omitted for
  // reaction-emitted applies (sourceUnitId carries the actor) and other
  // pre-S32 emitters; new since Session 32 to support the pre-battle
  // equipment auto-status reroute via `commitAction`.
  readonly context?: SystemApplyStatusContext;
}
// Discriminator union for the optional `context` field. Open to
// extension as new emission sites need attribution beyond a unit-id +
// sequence-number pair.
export type SystemApplyStatusContext = {
  readonly kind: 'pre_battle_equipment';
  readonly itemId: ItemId;
};
export interface SystemApplyStatusOutcome {
  readonly kind: 'system_apply_status';
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
  readonly result: StatusApplicationOutcome;
}

// `system_ct_push` — engine-emitted action that adjusts a unit's CT by a
// signed delta. Positive delta moves CT toward the 100 trigger threshold
// (Tide Surge ally bump, Tidal Pull self-+20-on-damage, Flow State magic-
// action refund). Negative delta pushes CT back toward 0 (Water Strike's
// damage rider). Floored at 0; not capped above 100 (the design allows
// pushes past 100, see docs/design/ct-system.md).
//
// Used by Water Mage's CT manipulation primitives (session 18). The
// reducer reads the unit's current CT, computes max(0, ct + delta), and
// records the actual delta applied (which differs from the requested
// delta when the floor clamps).
export interface SystemCtPushPayload {
  readonly targetId: UnitId;
  readonly delta: number; // signed; positive = forward, negative = backward
  readonly source: SystemCtPushSource;
}
export interface SystemCtPushOutcome {
  readonly kind: 'system_ct_push';
  readonly targetId: UnitId;
  readonly delta: number; // requested delta
  readonly applied: number; // post-floor delta (may differ from requested)
}
// Provenance for a system_ct_push. `damage_rider` covers Water Strike's
// on-hit push and Maelstrom-style cone riders; `ct_effect` covers free-
// standing CT pushes from `effects.ctEffects` (Tide Surge); `reaction`
// covers Tidal Pull's self-CT bump on damage; `support` covers Flow
// State's post-action refund. Future variants extend the union.
export type SystemCtPushSource =
  | { readonly kind: 'damage_rider'; readonly abilityId: AbilityId; readonly attackerId: UnitId }
  | { readonly kind: 'ct_effect'; readonly abilityId: AbilityId; readonly attackerId: UnitId }
  | { readonly kind: 'reaction'; readonly abilityId: AbilityId; readonly attackerId: UnitId }
  | { readonly kind: 'support'; readonly abilityId: AbilityId; readonly unitId: UnitId }
  // S74 (ADR-0126): Ring of Caliora's magical-hit CT drain — a negative
  // push fired from the wearer's `onFinalDamage` hook.
  | { readonly kind: 'equipment_ct_drain'; readonly itemId: ItemId; readonly attackerId: UnitId }
  // TABA M3 (Epee): a positive self-push fired from the wielder's
  // `onActionResolved` hook after a basic weapon attack (the PA-worth
  // CT refund).
  | { readonly kind: 'equipment_ct_refund'; readonly itemId: ItemId; readonly unitId: UnitId };

// `system_cover_redirect` — TABA Seam 2 (cover). Engine-emitted by the
// `cover_redirect` damage handler when a bearer soaks a fraction of a covered
// ally's RAW incoming hit. The reducer runs `amount` through a mitigation-only
// pass against the bearer (their Protect / resistances / armor reduce it — the
// point of a tank), then applies the mitigated HP loss. `sourceAbilityId`
// supplies the damage tags for resistance gating; `coveredId` is carried for
// the action log. Distinct from `system_damage` (which bypasses mitigation):
// cover DELIBERATELY mitigates, so it can't be a `system_damage` emission.
export interface SystemCoverRedirectPayload {
  readonly coverId: UnitId; // the bearer soaking the hit
  readonly coveredId: UnitId; // the ally whose hit was redirected (log only)
  readonly attackerId: UnitId; // original attacker (mitigation attribution)
  readonly sourceAbilityId: AbilityId;
  readonly amount: number; // RAW redirected amount (pre-mitigation)
}
export interface SystemCoverRedirectOutcome {
  readonly kind: 'system_cover_redirect';
  readonly coverId: UnitId;
  readonly amountRaw: number; // pre-mitigation redirected amount
  readonly damageDealt: number; // post-mitigation HP the bearer actually lost
}

// `system_set_ct` — engine-emitted action that sets a unit's CT to an
// absolute value. Distinct from `system_ct_push` (delta-based): set is
// "make this unit's CT exactly N." v1 producer is the orchestrator's
// pre-battle phase per ADR-0071, emitting one `system_set_ct` per unit
// to record the initial-CT randomization into the action log (so replay
// captures the wobble from sequence 0). Future use cases (debug-reset,
// content-driven absolute-CT manipulation) extend the source union.
//
// Clamps to [0, TRIGGER_THRESHOLD - 1] inclusive — no unit starts pre-
// triggered; the scheduler is the only path that lifts CT to ≥ 100.
export interface SystemSetCtPayload {
  readonly targetId: UnitId;
  readonly ct: number;
  readonly source: SystemSetCtSource;
}
export interface SystemSetCtOutcome {
  readonly kind: 'system_set_ct';
  readonly targetId: UnitId;
  readonly ct: number; // post-clamp applied value
  readonly previousCt: number;
}
export type SystemSetCtSource =
  | { readonly kind: 'initial_ct' }
  // S74 (ADR-0125): a battle-start CT seed from equipment (Greaves of
  // Seraphis). Overrides the initial_ct formula draw for the wearer.
  | { readonly kind: 'equipment'; readonly itemId: ItemId };

// `status_remove` — engine-emitted action that removes a named status
// instance from a target unit. Idempotent: a no-op if the status is
// not present (logged as `removed: false`). Used by ADR-0017 patterns
// (Sleep wake-on-damage, Vulnerable consume-on-damage). Per ADR-0024.
export interface StatusRemovePayload {
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
}
export interface StatusRemoveOutcome {
  readonly kind: 'status_remove';
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
  readonly removed: boolean;
}

// `status_decrement_stack` — decrement an existing instance's stack
// count by 1; remove the instance if stacks reach 0. Used by Burn
// (per ADR-0017) when its CT-100 trigger fires. v1 has no consumer;
// the reducer ships now alongside status_remove for the ADR-0017
// commit. Per ADR-0024.
export interface StatusDecrementStackPayload {
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
}
export interface StatusDecrementStackOutcome {
  readonly kind: 'status_decrement_stack';
  readonly targetId: UnitId;
  readonly statusTypeId: StatusTypeId;
  readonly newStackCount: number; // 0 means the instance was removed
  readonly removed: boolean;
}

// Session 39a: `system_ko_tick` — scheduler-emitted action that bumps
// a KO'd unit's permadeath counter by 1 and resets their virtual CT
// to 0. Fired when the scheduler advances a KO'd unit's virtual CT
// to the trigger threshold (CT 100). If the bump brings `turnsKOd` to
// the ruleset's `permadeath.threshold`, the reducer also emits a
// `system_unit_removed` via generatedActions; otherwise the unit
// stays KO'd-recoverable and the next virtual tick is a fresh cycle.
export interface SystemKoTickPayload {
  readonly targetId: UnitId;
}
export interface SystemKoTickOutcome {
  readonly kind: 'system_ko_tick';
  readonly targetId: UnitId;
  readonly turnsKOdAfter: number;
  // True when this tick also queued a `system_unit_removed` for the
  // same unit. Lets the action log distinguish "tick 1 of 3" from
  // "tick 3 of 3 — removed."
  readonly removalQueued: boolean;
}

// TABA M2 (ADR-0139): `system_xp_award` — a unit gains XP from a connecting,
// effect-having action, and levels up MID-BATTLE when it crosses `per_level`
// (XP rolls over). Generated by the resolver against the acting unit (like a
// reaction). Team-agnostic and OPT-IN: only a unit carrying a `statsByLevel`
// table (campaign units, both sides) is ever awarded this — Mage War / demo
// units have no table and never receive it, so the engine stays progression-
// ignorant. The level-up swaps `baseStats` to the next precomputed entry and
// bumps current HP/MP by the effective-max delta.
export interface SystemXpAwardPayload {
  readonly unitId: UnitId;
  // Gross XP for this action (base + level-delta + KO bonus), pre-rollover.
  readonly amount: number;
}
export interface SystemXpAwardOutcome {
  readonly kind: 'system_xp_award';
  readonly unitId: UnitId;
  readonly amount: number;
  // XP remainder after any level-ups this award triggered.
  readonly xpAfter: number;
  // 0 = XP gain only (no visual); > 0 = "Level Up!" (the animator's banner).
  readonly levelsGained: number;
  // Level after the award (== level before when `levelsGained` is 0).
  readonly newLevel: number;
}

// Session 39a: `system_unit_removed` — engine-emitted action that flips
// a unit's `removed` flag to true. Fired when the permadeath counter
// (`turnsKOd`) crosses the ruleset threshold during scheduler
// virtual-CT accumulation. The unit's HP/MP stay at 0/0 and they
// remain in `state.units` (referenced by historical log entries) but
// the engine filters them out of target eligibility, AoE membership,
// tile occupancy, and the scheduler's KO virtual-CT accumulator.
// Cannot be undone — Phoenix Down on a `removed` unit fizzles with no
// HP applied. After the action commits, the standard
// `evaluateBattleOutcome` check (`hp > 0`) treats them as defeated
// without special-casing the removed flag.
export interface SystemUnitRemovedPayload {
  readonly targetId: UnitId;
  // Ch1 substrate: absent = permadeath (the original Session 39a
  // meaning); 'retreated' = a death-protected unit's lethal hit was
  // converted to a retreat (`Unit.retreated` already set by the damage
  // write; this action supplies the `removed` flip + the log line).
  readonly reason?: 'retreated';
}
export interface SystemUnitRemovedOutcome {
  readonly kind: 'system_unit_removed';
  readonly targetId: UnitId;
  readonly turnsKOdAtRemoval: number; // for action-log attribution
  readonly reason?: 'retreated';
}

// Session 53 (ADR-0088): `system_terrain_change` — engine-emitted action
// that mutates the elevation + terrain of one or more tiles in lockstep,
// producing a structurally-shared new `map.tiles`. The Terraformer's
// Worldcraft abilities (Pillar/Pit/Hill/Valley — S54) emit one per cast
// carrying the whole affected tile-set; the effect-queue's LIFO revert
// emits one carrying the inverse deltas. Per-cast granularity keeps a cast
// and its revert atomic.
//
// Each change carries both the original and new values: `new*` is what the
// reducer writes; `original*` lets a revert reconstruct the prior terrain
// without re-deriving it. `terrain` is elevation-derived under the water-
// table convention, so the two move together (a tile lowered into elev 0
// becomes deep water, etc.) — the *emitter* computes both; the reducer just
// applies them.
//
// Fall damage is NOT in the payload: the reducer detects occupied tiles
// whose elevation drops and emits `'falling'` `system_damage` via the
// shared helper (a rising tile is not a drop and emits nothing).
export interface TerrainTileChange {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly originalElevation: number;
  readonly newElevation: number;
  readonly originalTerrain: TerrainType;
  readonly newTerrain: TerrainType;
}
export interface SystemTerrainChangePayload {
  readonly tileChanges: ReadonlyArray<TerrainTileChange>;
}
export interface SystemTerrainChangeOutcome {
  readonly kind: 'system_terrain_change';
  readonly tileChanges: ReadonlyArray<TerrainTileChange>;
  // How many of the requested tiles existed and were written. Normally
  // equals `tileChanges.length`; a smaller count flags a malformed cast
  // (a change addressing a non-existent (x,y,layer)).
  readonly appliedCount: number;
  // Ids of units that took fall damage from a dropped tile, for action-log
  // attribution. The damage itself rides the generated `system_damage`
  // actions; this is just the roster.
  readonly fallDamageUnitIds: ReadonlyArray<UnitId>;
}

// Session 53 (ADR-0088): `system_barrier_change` — sets or clears the
// `Tile.barrier` field on one or more tiles. Spawns barriers on a Barrier
// cast (`barrier` = a BarrierState) and clears them on revert / TTL expiry
// (`barrier` = null). Parallel to `system_terrain_change`; kept separate
// because it mutates a different tile field (barrier presence, not
// elevation/terrain). No fall damage — barriers occupy unoccupied tiles.
export interface BarrierTileChange {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  // The barrier to place, or `null` to clear any barrier on the tile.
  readonly barrier: BarrierState | null;
}
export interface SystemBarrierChangePayload {
  readonly tileChanges: ReadonlyArray<BarrierTileChange>;
}
export interface SystemBarrierChangeOutcome {
  readonly kind: 'system_barrier_change';
  readonly appliedCount: number;
}

// Session 53 (ADR-0088): `system_barrier_damage` — reduces the HP of the
// barrier on a single tile, destroying it (clearing `Tile.barrier`) at HP ≤ 0.
// Bypasses the seven-stage `Unit`-typed damage pipeline entirely (no
// variance/Faith/resistance/reactions) — barriers are inert objects, so the
// emitter precomputes `amount`. This parallels the pipeline-bypass property
// of `system_damage` without overloading that action's `targetId: UnitId`
// shape; a barrier is addressed by tile coordinate, not unit id.
export interface BarrierDamageSource {
  readonly attackerId: UnitId;
  readonly abilityId: AbilityId;
}
export interface SystemBarrierDamagePayload {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly amount: number;
  readonly source: BarrierDamageSource;
}
export interface SystemBarrierDamageOutcome {
  readonly kind: 'system_barrier_damage';
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly applied: number; // HP actually removed (clamped at the barrier's HP)
  readonly hpAfter: number; // barrier HP after (0 when destroyed)
  readonly destroyed: boolean;
}

// S96 (bridges, ADR-0155): `system_bridge_destroy` — PERMANENTLY removes
// one or more layer≥1 deck tiles from the map. Unlike `system_terrain_change`
// this is not revertible and never enters the Worldcraft effect queue: the
// earth remembers, carpentry doesn't. Emitted by (a) a lowering Worldcraft
// cast (Pit/Valley) whose kernel lands on deck tiles, and (b) the RAM rule —
// a terrain raise that would leave less than the minimum clearance under a
// deck (reduceSystemTerrainChange chains the destroy). Any barrier standing
// on the deck is removed with its tile. Occupants of a destroyed deck fall
// to the layer-0 tile at their (x,y) — or, if that tile is occupied, the
// first free cardinal-neighbor layer-0 tile (N/E/S/W order) — taking the
// full true-elevation drop as falling damage via the shared helper.
export interface BridgeDestroyTile {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}
export interface SystemBridgeDestroyPayload {
  readonly tiles: ReadonlyArray<BridgeDestroyTile>;
}
export interface BridgeFall {
  readonly unitId: UnitId;
  readonly to: Position;
  readonly drop: number;
}
export interface SystemBridgeDestroyOutcome {
  readonly kind: 'system_bridge_destroy';
  // How many of the addressed tiles existed (at layer ≥ 1) and were removed.
  readonly appliedCount: number;
  // Units dropped by the collapsing deck: landing position + elevation drop.
  // The damage itself rides generated `system_damage` falling actions.
  readonly fallen: ReadonlyArray<BridgeFall>;
}

// `battle_end` is the terminal system action that commits when a
// victory condition fires. Carries the winning team and the index of
// the satisfied condition (back-pointer into `state.victoryConditions`
// — same condition the post-action `state.outcome` reads from). After
// `battle_end` commits, `state.outcome` is set; further action commits
// are refused.
export interface BattleEndPayload {
  readonly winner: TeamId;
  readonly conditionIndex: number;
}
export interface BattleEndOutcome {
  readonly kind: 'battle_end';
  readonly winner: TeamId;
  readonly conditionIndex: number;
  readonly description: string;
  // Ch1 substrate: the fired condition's outcome tag when it carried
  // one (predicate conditions — e.g. "ester-good"). Mirrors
  // `DecidedOutcome.outcome`.
  readonly outcome?: string;
}

// === Universal envelope shared by every action ===

export interface ActionEnvelope {
  readonly sequenceNumber: number;
  readonly source: ActionSource;
  readonly actorId?: UnitId;
  readonly timestamp: { readonly tick: number; readonly ct: number };
  readonly seed: number;
  // Reaction-chain bookkeeping. `parentActionSeq` is set when this
  // action was generated by another's resolution (Counter triggered by
  // Attack, etc.). `chainDepth` is 0 for player/system root actions and
  // increments per chain step. `isReaction` is true for actions that
  // count against the reaction cap. See action-resolution.md
  // ("Reactions and the action chain").
  readonly parentActionSeq?: number;
  readonly chainDepth: number;
  readonly isReaction: boolean;
}

// === The discriminated union ===

export type Action = ActionEnvelope &
  (
    | { readonly type: 'move'; readonly payload: MovePayload; readonly outcome?: MoveOutcome }
    | {
        readonly type: 'use_ability';
        readonly payload: UseAbilityPayload;
        readonly outcome?: UseAbilityOutcome;
      }
    | {
        readonly type: 'use_compound';
        readonly payload: UseCompoundPayload;
        readonly outcome?: UseCompoundOutcome;
      }
    | {
        readonly type: 'use_throw_item';
        readonly payload: UseThrowItemPayload;
        readonly outcome?: UseThrowItemOutcome;
      }
    | { readonly type: 'wait'; readonly payload: WaitPayload; readonly outcome?: WaitOutcome }
    | {
        readonly type: 'set_facing';
        readonly payload: SetFacingPayload;
        readonly outcome?: SetFacingOutcome;
      }
    | {
        readonly type: 'turn_start';
        readonly payload: TurnStartPayload;
        readonly outcome?: TurnStartOutcome;
      }
    | {
        readonly type: 'turn_end';
        readonly payload: TurnEndPayload;
        readonly outcome?: TurnEndOutcome;
      }
    | {
        readonly type: 'charged_action_resolve';
        readonly payload: ChargedActionResolvePayload;
        readonly outcome?: ChargedActionResolveOutcome;
      }
    | {
        readonly type: 'status_tick';
        readonly payload: StatusTickPayload;
        readonly outcome?: StatusTickOutcome;
      }
    | {
        readonly type: 'system_heal';
        readonly payload: SystemHealPayload;
        readonly outcome?: SystemHealOutcome;
      }
    | {
        readonly type: 'system_damage';
        readonly payload: SystemDamagePayload;
        readonly outcome?: SystemDamageOutcome;
      }
    | {
        readonly type: 'system_mp_restore';
        readonly payload: SystemMpRestorePayload;
        readonly outcome?: SystemMpRestoreOutcome;
      }
    | {
        readonly type: 'system_mp_drain';
        readonly payload: SystemMpDrainPayload;
        readonly outcome?: SystemMpDrainOutcome;
      }
    | {
        readonly type: 'system_ko_tick';
        readonly payload: SystemKoTickPayload;
        readonly outcome?: SystemKoTickOutcome;
      }
    | {
        readonly type: 'system_xp_award';
        readonly payload: SystemXpAwardPayload;
        readonly outcome?: SystemXpAwardOutcome;
      }
    | {
        readonly type: 'system_unit_removed';
        readonly payload: SystemUnitRemovedPayload;
        readonly outcome?: SystemUnitRemovedOutcome;
      }
    | {
        readonly type: 'system_terrain_change';
        readonly payload: SystemTerrainChangePayload;
        readonly outcome?: SystemTerrainChangeOutcome;
      }
    | {
        readonly type: 'system_barrier_change';
        readonly payload: SystemBarrierChangePayload;
        readonly outcome?: SystemBarrierChangeOutcome;
      }
    | {
        readonly type: 'system_barrier_damage';
        readonly payload: SystemBarrierDamagePayload;
        readonly outcome?: SystemBarrierDamageOutcome;
      }
    | {
        readonly type: 'system_bridge_destroy';
        readonly payload: SystemBridgeDestroyPayload;
        readonly outcome?: SystemBridgeDestroyOutcome;
      }
    | {
        readonly type: 'system_apply_status';
        readonly payload: SystemApplyStatusPayload;
        readonly outcome?: SystemApplyStatusOutcome;
      }
    | {
        readonly type: 'system_ct_push';
        readonly payload: SystemCtPushPayload;
        readonly outcome?: SystemCtPushOutcome;
      }
    | {
        readonly type: 'system_cover_redirect';
        readonly payload: SystemCoverRedirectPayload;
        readonly outcome?: SystemCoverRedirectOutcome;
      }
    | {
        readonly type: 'system_set_ct';
        readonly payload: SystemSetCtPayload;
        readonly outcome?: SystemSetCtOutcome;
      }
    | {
        readonly type: 'status_remove';
        readonly payload: StatusRemovePayload;
        readonly outcome?: StatusRemoveOutcome;
      }
    | {
        readonly type: 'status_decrement_stack';
        readonly payload: StatusDecrementStackPayload;
        readonly outcome?: StatusDecrementStackOutcome;
      }
    | {
        readonly type: 'battle_end';
        readonly payload: BattleEndPayload;
        readonly outcome?: BattleEndOutcome;
      }
  );

export type ActionOutcome =
  | MoveOutcome
  | UseAbilityOutcome
  | UseCompoundOutcome
  | UseThrowItemOutcome
  | WaitOutcome
  | SetFacingOutcome
  | TurnStartOutcome
  | TurnEndOutcome
  | ChargedActionResolveOutcome
  | StatusTickOutcome
  | SystemHealOutcome
  | SystemDamageOutcome
  | SystemMpRestoreOutcome
  | SystemMpDrainOutcome
  | SystemApplyStatusOutcome
  | SystemCtPushOutcome
  | SystemCoverRedirectOutcome
  | SystemSetCtOutcome
  | SystemKoTickOutcome
  | SystemXpAwardOutcome
  | SystemUnitRemovedOutcome
  | SystemTerrainChangeOutcome
  | SystemBarrierChangeOutcome
  | SystemBarrierDamageOutcome
  | SystemBridgeDestroyOutcome
  | StatusRemoveOutcome
  | StatusDecrementStackOutcome
  | BattleEndOutcome;

// `GeneratedReaction` pairs a reaction's `ProposedAction` with the id
// of the unit whose hook produced it. The reactor id is needed for
// per-unit-per-turn reaction-cap accounting in `commitAction` —
// `system_apply_status` reactions (Earth Resilience self-buff) don't
// carry actorId on the action itself, so cap accounting can't read the
// reactor from the action alone. Carrying the reactor id alongside the
// action keeps the cap key tight to "which unit reacted," independent
// of the action shape. Per ADR-0024's noted limitation and the session
// 17 fix.
//
// Only emitted by `runOnActionTargeted` today; future reaction surfaces
// extend this shape if they introduce new generation points. Non-
// reaction generated actions (turn_start's status_tick fan-out, system_
// heal from onTick) don't go through the cap and stay on the
// `generatedActions` field.
export interface GeneratedReaction {
  readonly action: ProposedAction;
  readonly reactorId: UnitId;
  // Session 55: identifies the single reaction *trigger* (one handler firing)
  // that produced this action. A reaction may emit several actions at once —
  // Damage Split's `reflect_damage` emits a reflect (`system_damage` to the
  // attacker) AND a paired self-heal (`system_heal`) — and they must count as
  // ONE reaction against the per-unit-per-turn cap and share one Brave-roll
  // admit/deny decision. `commitAction` keys the cap on this id: the first
  // action of a group consumes (or is denied) a cap slot, and its siblings
  // follow the same decision. Emissions from distinct triggers carry distinct
  // ids; each still counts separately. Absent (legacy) → each action is its
  // own group, i.e. the pre-S55 one-action-per-cap-slot behavior.
  readonly reactionGroupId?: number;
}

// `ProposedAction` is what a controller (player UI, AI) hands the
// engine. The engine fills in the envelope (seq, seed, timestamp, chain
// bookkeeping) at commit time. Controllers don't see the universal
// envelope — they describe *what* to do, the engine answers *when* and
// *what seed*.
export type ProposedAction =
  | {
      readonly type: 'move';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: MovePayload;
    }
  | {
      readonly type: 'use_ability';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: UseAbilityPayload;
    }
  | {
      readonly type: 'use_compound';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: UseCompoundPayload;
    }
  | {
      readonly type: 'use_throw_item';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: UseThrowItemPayload;
    }
  | {
      readonly type: 'wait';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: WaitPayload;
    }
  | {
      readonly type: 'set_facing';
      readonly source: ActionSource;
      readonly actorId: UnitId;
      readonly payload: SetFacingPayload;
    }
  | {
      readonly type: 'turn_start';
      readonly source: 'system';
      readonly payload: TurnStartPayload;
    }
  | {
      readonly type: 'turn_end';
      readonly source: 'system';
      readonly payload: TurnEndPayload;
    }
  | {
      readonly type: 'charged_action_resolve';
      readonly source: 'system';
      readonly payload: ChargedActionResolvePayload;
    }
  | {
      readonly type: 'status_tick';
      readonly source: 'system';
      readonly payload: StatusTickPayload;
    }
  | {
      readonly type: 'system_heal';
      readonly source: 'system';
      readonly payload: SystemHealPayload;
    }
  | {
      readonly type: 'system_damage';
      readonly source: 'system';
      readonly payload: SystemDamagePayload;
    }
  | {
      readonly type: 'system_mp_restore';
      readonly source: 'system';
      readonly payload: SystemMpRestorePayload;
    }
  | {
      readonly type: 'system_mp_drain';
      readonly source: 'system';
      readonly payload: SystemMpDrainPayload;
    }
  | {
      readonly type: 'system_ko_tick';
      readonly source: 'system';
      readonly payload: SystemKoTickPayload;
    }
  | {
      readonly type: 'system_xp_award';
      readonly source: 'system';
      readonly payload: SystemXpAwardPayload;
    }
  | {
      readonly type: 'system_unit_removed';
      readonly source: 'system';
      readonly payload: SystemUnitRemovedPayload;
    }
  | {
      readonly type: 'system_terrain_change';
      readonly source: 'system';
      readonly payload: SystemTerrainChangePayload;
    }
  | {
      readonly type: 'system_barrier_change';
      readonly source: 'system';
      readonly payload: SystemBarrierChangePayload;
    }
  | {
      readonly type: 'system_barrier_damage';
      readonly source: 'system';
      readonly payload: SystemBarrierDamagePayload;
    }
  | {
      readonly type: 'system_bridge_destroy';
      readonly source: 'system';
      readonly payload: SystemBridgeDestroyPayload;
    }
  | {
      readonly type: 'system_apply_status';
      readonly source: 'system';
      readonly payload: SystemApplyStatusPayload;
    }
  | {
      readonly type: 'system_ct_push';
      readonly source: 'system';
      readonly payload: SystemCtPushPayload;
    }
  | {
      readonly type: 'system_cover_redirect';
      readonly source: 'system';
      readonly payload: SystemCoverRedirectPayload;
    }
  | {
      readonly type: 'system_set_ct';
      readonly source: 'system';
      readonly payload: SystemSetCtPayload;
    }
  | {
      readonly type: 'status_remove';
      readonly source: 'system';
      readonly payload: StatusRemovePayload;
    }
  | {
      readonly type: 'status_decrement_stack';
      readonly source: 'system';
      readonly payload: StatusDecrementStackPayload;
    }
  | {
      readonly type: 'battle_end';
      readonly source: 'system';
      readonly payload: BattleEndPayload;
    };
