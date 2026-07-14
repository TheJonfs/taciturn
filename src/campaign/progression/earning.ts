// TABA M2 progression — the per-action JP earning mechanism.
//
// JP is earned PER connecting action (Chris's rule). For each connecting
// action taken by a PLAYER-ROSTER unit:
//   - the ACTOR earns `base(actorLevel)` JP — default `floor(10 + level/4)` —
//     into its own current class;
//   - EVERY OTHER roster unit (in battle AND on the bench) earns
//     `SPILLOVER_FRACTION` (1/8) of that amount into ITS current class.
// (A Knight swings its sword → Knight JP for the Knight, a slice of Pyromancer
// JP for the benched Pyromancer.) Enemy actions earn nothing.
//
// Mechanism (M2 substrate audit): a POST-HOC read of the terminal action log —
// NO engine hook (rules 1 & 8 untouched); deterministic (the log is a replay
// artifact). Because the SPILLOVER reaches benched units not in the battle,
// this needs the full roster, so it runs at apply-back (which has both the log
// and the roster), not in the battle-facing summarizer.
//
// The trigger (`connecting`) and the distribution are SHARED with XP — only
// `base` differs — so both are injectable and XP reuses this with a different
// `base` equation.

import type { Action, UnitId } from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';

// Base JP the action-taker earns, as a function of its level. Default:
// `floor(10 + level/4)`. Injectable so XP reuses the trigger with its own
// equation.
export type JpBaseFn = (level: number) => number;
export const defaultJpBase: JpBaseFn = (level) => Math.floor(10 + level / 4);

// The fraction of the actor's base that every OTHER roster unit earns.
export const SPILLOVER_FRACTION = 1 / 8;

// Does this action earn? Default: a non-reaction ability / thrown-item /
// charged-resolve that landed at least one hit. Injectable so the final rule
// (e.g. excluding pure buffs/heals) is a one-line swap, not a rewrite.
export type ConnectingActionPredicate = (action: Action) => boolean;

export function defaultConnectingPredicate(action: Action): boolean {
  if (action.isReaction) return false; // reactions never earn
  // Rider casts (weapon attackProcs) never earn either — the weapon acts,
  // not the wielder. Mirrors the engine's XP-award guard (S94: the root
  // attack + its proc each banked JP — the double-award bug).
  if (action.type === 'use_ability' && action.payload.riderSource !== undefined) return false;
  const outcome = action.outcome;
  if (outcome === undefined) return false;
  if (
    outcome.kind !== 'use_ability' &&
    outcome.kind !== 'use_throw_item' &&
    outcome.kind !== 'charged_action_resolve'
  ) {
    return false;
  }
  // "Connecting" = at least one per-target result landed. A total miss earns
  // nothing; the charged COMMIT (no per-target results yet) earns nothing and
  // only its RESOLVE counts — so no double-count.
  return outcome.perTargetResults.some((r) => r.hit);
}

export interface EarnOptions {
  readonly base?: JpBaseFn;
  readonly connecting?: ConnectingActionPredicate;
  readonly spilloverFraction?: number;
}

// JP earned per roster unit over the terminal action log, each amount destined
// for that unit's CURRENT class (the caller credits it there). Spillover is
// accumulated exactly (multiples of base/8, exact in float) and floored once
// per unit. Only entries > 0 are returned; absent ⇒ earned nothing.
export function computeEarnedJp(
  actionLog: ReadonlyArray<Action>,
  roster: ReadonlyArray<CampaignUnit>,
  options: EarnOptions = {},
): ReadonlyMap<UnitId, number> {
  const base = options.base ?? defaultJpBase;
  const connecting = options.connecting ?? defaultConnectingPredicate;
  const spillover = options.spilloverFraction ?? SPILLOVER_FRACTION;

  const levelOf = new Map<UnitId, number>();
  for (const u of roster) levelOf.set(u.id, u.level);

  const acc = new Map<UnitId, number>();
  const add = (id: UnitId, amount: number): void => {
    acc.set(id, (acc.get(id) ?? 0) + amount);
  };

  for (const action of actionLog) {
    const actor = action.actorId;
    // Only player-roster connecting actions generate JP.
    if (actor === undefined || !levelOf.has(actor)) continue;
    if (!connecting(action)) continue;

    const b = base(levelOf.get(actor)!);
    add(actor, b);
    const share = b * spillover;
    if (share > 0) {
      for (const other of roster) {
        if (other.id !== actor) add(other.id, share);
      }
    }
  }

  const out = new Map<UnitId, number>();
  for (const [id, raw] of acc) {
    const floored = Math.floor(raw);
    if (floored > 0) out.set(id, floored);
  }
  return out;
}
