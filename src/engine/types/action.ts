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

export type ActionType =
  | 'move'
  | 'use_ability'
  | 'wait'
  | 'set_facing'
  | 'turn_start'
  | 'turn_end'
  | 'charged_action_resolve'
  | 'status_tick'
  | 'system_heal'
  | 'system_damage'
  | 'system_mp_drain'
  | 'system_apply_status'
  | 'system_ct_push'
  | 'system_set_ct'
  | 'status_remove'
  | 'status_decrement_stack'
  | 'battle_end';

export type ActionSource = 'player' | 'system';

// What target an ability action is aimed at. `self` for `targeting.kind:
// 'self'` abilities; `unit` for single-unit targeting; `tile` for
// tile-anchored targeting (resolves at the position regardless of which
// unit is there at resolution time — FFT location-deterministic
// behavior). AoE per-target dispatch lands additively in session 17;
// per-target results for AoE / tile-anchored damage are still
// unit-keyed.
export type AbilityTarget =
  | { readonly kind: 'self' }
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'tile'; readonly position: Position };

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
}

export interface WaitPayload {
  readonly _empty?: never;
}
export interface WaitOutcome {
  readonly kind: 'wait';
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
export type SystemHealSource =
  | { readonly kind: 'status_tick'; readonly statusTypeId: StatusTypeId; readonly unitId: UnitId };

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
  | { readonly kind: 'ability_self_cost'; readonly abilityId: AbilityId; readonly casterId: UnitId };

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
  | { readonly kind: 'support'; readonly abilityId: AbilityId; readonly unitId: UnitId };

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
export type SystemSetCtSource = { readonly kind: 'initial_ct' };

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
        readonly type: 'system_mp_drain';
        readonly payload: SystemMpDrainPayload;
        readonly outcome?: SystemMpDrainOutcome;
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
  | WaitOutcome
  | SetFacingOutcome
  | TurnStartOutcome
  | TurnEndOutcome
  | ChargedActionResolveOutcome
  | StatusTickOutcome
  | SystemHealOutcome
  | SystemDamageOutcome
  | SystemMpDrainOutcome
  | SystemApplyStatusOutcome
  | SystemCtPushOutcome
  | SystemSetCtOutcome
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
      readonly type: 'system_mp_drain';
      readonly source: 'system';
      readonly payload: SystemMpDrainPayload;
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
