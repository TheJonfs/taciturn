// commitAction — the action lifecycle wrapper.
// See docs/design/action-resolution.md ("Action lifecycle") and ADR-0009.
//
// Orchestrates the 8 stages: propose → validate → seed → pre-hooks →
// reduce → resolution-hooks → commit → process-chain. Pure given
// (state, proposed, catalog).
//
// Chain processing is FIFO: the root proposed action commits first;
// each commit may generate further actions that enter a queue and
// commit in turn until empty. Reaction caps and chain-depth caps come
// from the active ruleset; exceeding either short-circuits chain
// processing (depth cap throws, reaction cap drops the action).

import type { Catalog } from '../catalog/index.ts';
import { runOnActionAttempted } from '../hooks/runners.ts';
import {
  getUnit,
  type Action,
  type ActionEnvelope,
  type ActionSource,
  type GameState,
  type ProposedAction,
  type UnitId,
} from '../types/index.ts';
import { reduce } from './reduce.ts';
import { isRiderCast } from './payload-helpers.ts';
import { deriveActionSeed } from './seed.ts';
import { validateAction, type ValidationResult } from './validate.ts';

export interface CommitSuccess {
  readonly ok: true;
  readonly newState: GameState;
  // Every action that landed (root + chain), in commit order with
  // their outcomes populated.
  readonly committed: ReadonlyArray<Action>;
}

export interface CommitFailure {
  readonly ok: false;
  readonly stage: 'validation' | 'hook_blocked' | 'battle_decided';
  readonly reason: string;
  readonly rejected: ProposedAction;
}

export type CommitResult = CommitSuccess | CommitFailure;

interface QueueEntry {
  readonly action: ProposedAction;
  readonly parentSeq?: number;
  readonly depth: number;
  readonly isReaction: boolean;
  // Set when `isReaction === true`. Identifies the unit whose hook
  // produced the reaction — accounted against the per-unit-per-turn
  // reaction cap independent of whether the emitted action carries
  // `actorId` (system_apply_status reactions don't, per ADR-0024).
  readonly reactorId?: UnitId;
}

// Thread-the-needle helper: produce the next sequence number and a
// fresh state with the rng counter advanced.
function bumpSeq(state: GameState): { seq: number; newState: GameState } {
  const seq = state.rng.nextSeq;
  const newState: GameState = {
    ...state,
    rng: { ...state.rng, nextSeq: seq + 1 },
  };
  return { seq, newState };
}

// Build a full Action from a ProposedAction by attaching the universal
// envelope (seq, seed, timestamp, chain bookkeeping).
function envelopeFor(
  proposed: ProposedAction,
  state: GameState,
  seq: number,
  parentSeq: number | undefined,
  depth: number,
  isReaction: boolean,
): Action {
  const seed = deriveActionSeed(state.rng.masterSeed, seq);
  const envelope: ActionEnvelope = {
    sequenceNumber: seq,
    source: proposed.source as ActionSource,
    timestamp: { tick: state.tick, ct: 0 },
    seed,
    chainDepth: depth,
    isReaction,
    ...(proposed.type !== 'turn_start' &&
    proposed.type !== 'turn_end' &&
    proposed.type !== 'status_tick' &&
    proposed.type !== 'charged_action_resolve' &&
    proposed.type !== 'system_heal' &&
    proposed.type !== 'system_damage' &&
    proposed.type !== 'system_apply_status' &&
    proposed.type !== 'system_ct_push' &&
    proposed.type !== 'system_mp_drain' &&
    proposed.type !== 'status_remove' &&
    proposed.type !== 'status_decrement_stack' &&
    proposed.type !== 'battle_end' &&
    'actorId' in proposed
      ? { actorId: proposed.actorId }
      : {}),
    ...(parentSeq !== undefined ? { parentActionSeq: parentSeq } : {}),
  };

  // The discriminated-union construction: pair the envelope with the
  // type-specific payload. TypeScript can't see that proposed.type and
  // proposed.payload align across the union without explicit help, so
  // we narrow per-kind.
  switch (proposed.type) {
    case 'move':
      return { ...envelope, type: 'move', payload: proposed.payload };
    case 'use_ability':
      return { ...envelope, type: 'use_ability', payload: proposed.payload };
    case 'wait':
      return { ...envelope, type: 'wait', payload: proposed.payload };
    case 'set_facing':
      return { ...envelope, type: 'set_facing', payload: proposed.payload };
    case 'turn_start':
      return { ...envelope, type: 'turn_start', payload: proposed.payload };
    case 'turn_end':
      return { ...envelope, type: 'turn_end', payload: proposed.payload };
    case 'status_tick':
      return { ...envelope, type: 'status_tick', payload: proposed.payload };
    case 'charged_action_resolve':
      return { ...envelope, type: 'charged_action_resolve', payload: proposed.payload };
    case 'system_heal':
      return { ...envelope, type: 'system_heal', payload: proposed.payload };
    case 'system_damage':
      return { ...envelope, type: 'system_damage', payload: proposed.payload };
    case 'system_apply_status':
      return { ...envelope, type: 'system_apply_status', payload: proposed.payload };
    case 'system_ct_push':
      return { ...envelope, type: 'system_ct_push', payload: proposed.payload };
    case 'system_mp_drain':
      return { ...envelope, type: 'system_mp_drain', payload: proposed.payload };
    case 'status_remove':
      return { ...envelope, type: 'status_remove', payload: proposed.payload };
    case 'status_decrement_stack':
      return { ...envelope, type: 'status_decrement_stack', payload: proposed.payload };
    case 'battle_end':
      return { ...envelope, type: 'battle_end', payload: proposed.payload };
    default: {
      // Exhaustiveness check. The `never` typing forces TS-strict to flag
      // missing cases at compile time when a new `ActionType` ships
      // without a matching envelope-construction branch. Surfaced via
      // playtest in Session 31: `system_mp_drain` shipped in Session 30
      // but the envelope switch silently fell through, returning
      // undefined at runtime and crashing the chain only when v1 content
      // (Rasp Pendant) finally emitted one. With this guard, the next
      // such omission fails the build.
      const _exhaustive: never = proposed;
      throw new Error(
        `envelopeFor: unhandled action type — add a case for the new ActionType. Got: ${JSON.stringify((_exhaustive as ProposedAction).type)}`,
      );
    }
  }
}

// Run the pre-resolution hook for the actor. System actions skip it
// (system actions originate from the engine; running hooks against
// the engine's own emissions is design noise). The `isReaction` flag
// (per ADR-0027) is threaded through so handlers like Don't Act can
// distinguish volitional UseAbility (block) from reactions (allow).
//
// Per ADR-0064 (Session 30): rider casts (weapon `attackProcs`) also
// skip onActionAttempted — the spell is the weapon's power, not the
// wielder's, so Silence / Stop / Don't Act handlers on the wielder do
// not gate the proc. (Stop on the wielder prevents the underlying
// swing from ever happening, so the proc can't fire either; explicit
// bypass here makes the intent clear at the gate.)
function runPreHook(
  state: GameState,
  proposed: ProposedAction,
  catalog: Catalog,
  isReaction: boolean,
):
  | { readonly outcome: 'allowed'; readonly action: ProposedAction }
  | { readonly outcome: 'replaced'; readonly action: ProposedAction }
  | { readonly outcome: 'blocked'; readonly reason: string } {
  if (proposed.source === 'system') return { outcome: 'allowed', action: proposed };
  if (proposed.type === 'use_ability' && isRiderCast(proposed.payload)) {
    return { outcome: 'allowed', action: proposed };
  }
  if (!('actorId' in proposed)) return { outcome: 'allowed', action: proposed };
  const actor = getUnit(state, proposed.actorId);
  const result = runOnActionAttempted(state, catalog, {
    unit: actor,
    action: proposed,
    isReaction,
  });
  if (result.kind === 'blocked') return { outcome: 'blocked', reason: result.reason };
  if (result.kind === 'replaced') return { outcome: 'replaced', action: result.with };
  return { outcome: 'allowed', action: proposed };
}

// Post-chain auto-emit checkpoint: if the active unit is KO'd at the
// end of the chain (e.g., Counter chain killed them mid-turn, charged
// spell with self-damage KO'd the caster, etc.), the engine emits a
// `turn_end` so the turn unwinds and the scheduler can advance. This
// supersedes the orchestrator-level guard ADR-0013 introduced; any
// caller of commitAction (demo orchestrator, future replay-driven or
// networked drivers) inherits the behavior. Captured in ADR-0023.
function shouldAutoEndTurn(state: GameState): boolean {
  if (state.turnState === null) return false;
  if (state.outcome !== undefined) return false;
  const actor = state.units.get(state.turnState.unitId);
  return actor !== undefined && actor.vitals.hp <= 0;
}

export function commitAction(
  initialState: GameState,
  proposed: ProposedAction,
  catalog: Catalog,
): CommitResult {
  const ruleset = catalog.getRuleset(initialState.ruleset.id);
  const queue: QueueEntry[] = [{ action: proposed, depth: 0, isReaction: false }];
  const committed: Action[] = [];
  let state = initialState;
  let isRoot = true;

  while (true) {
    if (queue.length === 0) {
      // Post-chain checkpoint. The auto-emitted turn_end may itself
      // emit further system actions (status_tick fan-out, battle_end);
      // they enter the queue and the loop continues. The outer
      // condition guarantees we never enter this branch when the
      // checkpoint is satisfied.
      if (!shouldAutoEndTurn(state)) break;
      const turnEndAction: ProposedAction = {
        type: 'turn_end',
        source: 'system',
        payload: { unitId: state.turnState!.unitId },
      };
      queue.push({ action: turnEndAction, depth: 0, isReaction: false });
      // Auto-emitted turn_end is never the *root* action — by
      // definition the chain has drained and we're in the post-root
      // path. Failures in this turn_end would be programmer errors.
      isRoot = false;
    }
    const entry = queue.shift()!;

    // Battle-decided guard — once `state.outcome` is set, refuse
    // further commits. The chain may still hold queued reactions or
    // status_ticks emitted before battle_end; drain them silently. The
    // root action's caller saw `ok: true` for the action that produced
    // battle_end; subsequent commits return `ok: false; stage: 'battle_decided'`.
    if (state.outcome !== undefined) {
      if (isRoot) {
        return {
          ok: false,
          stage: 'battle_decided',
          reason: 'battle has already decided',
          rejected: entry.action,
        };
      }
      // Mid-chain entry post-battle-end — silently drop. The drained
      // queue entries are not committed and not logged.
      isRoot = false;
      continue;
    }

    // Pre-validate.
    const validation: ValidationResult = validateAction(state, entry.action, catalog, {
      isReaction: entry.isReaction,
    });
    if (!validation.valid) {
      if (isRoot) {
        return {
          ok: false,
          stage: 'validation',
          reason: validation.reason ?? 'invalid action',
          rejected: entry.action,
        };
      }
      // Mid-chain validation failure: reactions fizzle silently
      // (the design intent — see ADR-0011); non-reaction system-
      // emitted actions failing validation are programmer errors and
      // throw. v1 doesn't have non-reaction generated actions whose
      // validation is non-trivial (status_tick / turn_end / battle_end
      // / charged_action_resolve all skip validation), so the throw
      // path stays loud for actual bugs.
      if (entry.isReaction) {
        isRoot = false;
        continue;
      }
      throw new Error(
        `commitAction: chain action of type ${JSON.stringify(entry.action.type)} failed validation: ${validation.reason ?? 'unknown'}`,
      );
    }

    // Pre-hook firing. Replaces or blocks per the actor's hooks.
    const hookResult = runPreHook(state, entry.action, catalog, entry.isReaction);
    if (hookResult.outcome === 'blocked') {
      if (isRoot) {
        return {
          ok: false,
          stage: 'hook_blocked',
          reason: hookResult.reason,
          rejected: entry.action,
        };
      }
      // A chain action being blocked is in scope per design ("a unit
      // KO'd mid-turn shouldn't react"); silently drop it.
      isRoot = false;
      continue;
    }
    const effectiveProposed =
      hookResult.outcome === 'replaced' ? hookResult.action : entry.action;

    // Reaction-cap accounting (only for chain reactions). The reactor
    // id rides on the queue entry — set when the reaction was enqueued
    // by the previous reducer's `generatedReactions`. Independent of
    // the emitted action's `actorId` shape, so system_apply_status
    // reactions (Earth Resilience self-buff) account correctly. Per
    // the session 17 fix to ADR-0024's noted limitation.
    if (entry.isReaction && state.turnState !== null && entry.reactorId !== undefined) {
      const used = state.turnState.reactionsUsedThisTurn.get(entry.reactorId) ?? 0;
      if (used >= ruleset.chainTermination.perUnitPerTurnReactions) {
        // Capped — drop. Future: emit a `reaction_capped` system event
        // for visibility; for now the silent drop is fine.
        isRoot = false;
        continue;
      }
      const updated = new Map(state.turnState.reactionsUsedThisTurn);
      updated.set(entry.reactorId, used + 1);
      state = {
        ...state,
        turnState: { ...state.turnState, reactionsUsedThisTurn: updated },
      };
    }

    // Chain-depth cap: hard rail per the design's safety net.
    if (entry.depth > ruleset.chainTermination.chainDepthCap) {
      throw new Error(
        `commitAction: chain depth ${entry.depth} exceeds cap ${ruleset.chainTermination.chainDepthCap}`,
      );
    }

    // Bump seq, build envelope, reduce.
    const { seq, newState: stateWithSeq } = bumpSeq(state);
    const built = envelopeFor(
      effectiveProposed,
      stateWithSeq,
      seq,
      entry.parentSeq,
      entry.depth,
      entry.isReaction,
    );
    const reduced = reduce(stateWithSeq, built, catalog);
    const { newState, outcome, generatedActions } = reduced;

    // Commit: the action with its outcome is appended to the log.
    const final: Action = { ...built, outcome } as Action;
    state = {
      ...newState,
      actionLog: [...newState.actionLog, final],
    };
    committed.push(final);

    // Enqueue generated actions FIFO. Non-reaction generated actions
    // (turn_start's status_tick fan-out, future emissions) get isReaction
    // = false. Reactions (Counter, Auto-Potion, Reflect emitted by the
    // damage pipeline's onActionTargeted call) come back on the optional
    // `generatedReactions` field with isReaction = true so the per-unit
    // reaction cap accounts them.
    for (const gen of generatedActions) {
      queue.push({
        action: gen,
        parentSeq: seq,
        depth: entry.depth + 1,
        isReaction: false,
      });
    }
    for (const rxn of reduced.generatedReactions ?? []) {
      queue.push({
        action: rxn.action,
        parentSeq: seq,
        depth: entry.depth + 1,
        isReaction: true,
        reactorId: rxn.reactorId,
      });
    }

    isRoot = false;
  }

  return { ok: true, newState: state, committed };
}
