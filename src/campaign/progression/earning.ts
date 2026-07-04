// TABA M2 progression — the per-action JP earning seam.
//
// JP is earned PER ACTION (Chris's call): a unit banks JP for each connecting
// action it takes in battle — not misses, not reactions. The EXACT rule is a
// mid-session design injection; this builds the SEAM + a tunable so nothing
// blocks, and keeps the "connecting" test injectable so the final rule is a
// one-line predicate change, not a redesign.
//
// Mechanism (M2 substrate audit): a POST-HOC read of the terminal action log,
// NOT a new engine hook. Every discriminator is already stored on committed
// actions — `actorId`, `isReaction`, and per-target `hit`. So this stays
// entirely in the campaign shell: the engine emits its normal log and knows
// nothing of JP (arch rules 1 & 8 untouched), and the read is deterministic
// (the log is a replay artifact).
//
// Only the player-roster units bank what this returns — apply-back matches by
// stable id, so enemy entries (also computed here) are simply never read.

import type { Action, UnitId } from '@engine/index.ts';

// The working anchor from the budget doc: ~14 JP per connecting action
// (≈ ~87/battle at ~6 actions). Tunable; superseded by Chris's injected rate.
export const DEFAULT_JP_PER_CONNECTING_ACTION = 14;

// Does this action earn JP? The default rule: a non-reaction ability / thrown-
// item / charged-resolve that landed at least one hit. Injectable so the final
// design (e.g. excluding pure buffs/heals, or weighting by target count) is a
// swap here, not a rewrite of the walk.
export type ConnectingActionPredicate = (action: Action) => boolean;

export function defaultConnectingPredicate(action: Action): boolean {
  if (action.isReaction) return false; // reactions never earn
  const outcome = action.outcome;
  if (outcome === undefined) return false;
  if (
    outcome.kind !== 'use_ability' &&
    outcome.kind !== 'use_throw_item' &&
    outcome.kind !== 'charged_action_resolve'
  ) {
    return false;
  }
  // "Connecting" = at least one per-target result landed. A pure miss (all
  // `hit: false`) earns nothing; the charged COMMIT (no per-target results
  // yet) earns nothing and only its RESOLVE counts — so no double-count.
  return outcome.perTargetResults.some((r) => r.hit);
}

export interface EarnOptions {
  readonly rate?: number;
  readonly connecting?: ConnectingActionPredicate;
}

// Earned JP per acting unit, summed over the terminal action log. Returns a
// map keyed by `actorId`; absent units earned nothing. Computed for EVERY
// actor (team-agnostic, like `summarizeBattleResult`); only roster units
// ultimately bank it.
export function computeEarnedJp(
  actionLog: ReadonlyArray<Action>,
  options: EarnOptions = {},
): ReadonlyMap<UnitId, number> {
  const rate = options.rate ?? DEFAULT_JP_PER_CONNECTING_ACTION;
  const connecting = options.connecting ?? defaultConnectingPredicate;

  const earned = new Map<UnitId, number>();
  for (const action of actionLog) {
    const actor = action.actorId;
    if (actor === undefined) continue;
    if (!connecting(action)) continue;
    earned.set(actor, (earned.get(actor) ?? 0) + rate);
  }
  return earned;
}
