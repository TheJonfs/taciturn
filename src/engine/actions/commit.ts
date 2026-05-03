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
  readonly stage: 'validation' | 'hook_blocked';
  readonly reason: string;
  readonly rejected: ProposedAction;
}

export type CommitResult = CommitSuccess | CommitFailure;

interface QueueEntry {
  readonly action: ProposedAction;
  readonly parentSeq?: number;
  readonly depth: number;
  readonly isReaction: boolean;
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
  }
}

// Run the pre-resolution hook for the actor. System actions skip it
// (system actions originate from the engine; running hooks against
// the engine's own emissions is design noise).
function runPreHook(
  state: GameState,
  proposed: ProposedAction,
  catalog: Catalog,
):
  | { readonly outcome: 'allowed'; readonly action: ProposedAction }
  | { readonly outcome: 'replaced'; readonly action: ProposedAction }
  | { readonly outcome: 'blocked'; readonly reason: string } {
  if (proposed.source === 'system') return { outcome: 'allowed', action: proposed };
  if (!('actorId' in proposed)) return { outcome: 'allowed', action: proposed };
  const actor = getUnit(state, proposed.actorId);
  const result = runOnActionAttempted(state, catalog, { unit: actor, action: proposed });
  if (result.kind === 'blocked') return { outcome: 'blocked', reason: result.reason };
  if (result.kind === 'replaced') return { outcome: 'replaced', action: result.with };
  return { outcome: 'allowed', action: proposed };
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

  while (queue.length > 0) {
    const entry = queue.shift()!;

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
      // Mid-chain validation failure for a system-generated action
      // is a programmer error — fail loud.
      throw new Error(
        `commitAction: chain action of type ${JSON.stringify(entry.action.type)} failed validation: ${validation.reason ?? 'unknown'}`,
      );
    }

    // Pre-hook firing. Replaces or blocks per the actor's hooks.
    const hookResult = runPreHook(state, entry.action, catalog);
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

    // Reaction-cap accounting (only for chain reactions).
    if (entry.isReaction && state.turnState !== null && 'actorId' in effectiveProposed) {
      const reactorId: UnitId = effectiveProposed.actorId;
      const used = state.turnState.reactionsUsedThisTurn.get(reactorId) ?? 0;
      if (used >= ruleset.chainTermination.perUnitPerTurnReactions) {
        // Capped — drop. Future: emit a `reaction_capped` system event
        // for visibility; for now the silent drop is fine.
        isRoot = false;
        continue;
      }
      const updated = new Map(state.turnState.reactionsUsedThisTurn);
      updated.set(reactorId, used + 1);
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
        action: rxn,
        parentSeq: seq,
        depth: entry.depth + 1,
        isReaction: true,
      });
    }

    isRoot = false;
  }

  return { ok: true, newState: state, committed };
}
