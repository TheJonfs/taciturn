// TABA M2 progression — the per-action JP earning mechanism.
//
// JP FOLLOWS XP (S95 earning audit, Chris's rule). The engine already
// decides which actions earn — reactions, rider procs, the no-effect
// anti-grind guard, Worldcraft's generated-change vouch, the charged-
// resolve Charging exclusion — and marks every earning action with a
// generated `system_xp_award` in the log. Rather than re-deriving that
// predicate in parallel (the S94 whack-a-mole: two dispatchers over the
// same effect shapes, each with its own silent gaps — a hit-based JP
// predicate paid on no-op heals the XP guard rejected, and on barrier
// attacks XP never paid), the JP walk keys off the awards themselves:
// one `system_xp_award` to a roster unit = one connecting action.
//
// For each award to a PLAYER-ROSTER unit:
//   - the recipient earns `base(rosterLevel)` JP — default
//     `floor(10 + level/4)` — into its own current class;
//   - EVERY OTHER roster unit (in battle AND on the bench) earns
//     `SPILLOVER_FRACTION` (1/8) of that amount into ITS current class.
// (A Knight swings its sword → Knight JP for the Knight, a slice of
// Pyromancer JP for the benched Pyromancer.) Awards to enemies and
// guests pay nothing — they're not in the roster.
//
// Mechanism unchanged from the M2 substrate audit: a POST-HOC read of
// the terminal action log — NO engine hook (rules 1 & 8 untouched);
// deterministic (the log is a replay artifact). Because the SPILLOVER
// reaches benched units not in the battle, this needs the full roster,
// so it runs at apply-back (which has both the log and the roster), not
// in the battle-facing summarizer.

import type { Action, UnitId } from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';

// Base JP the earning unit banks, as a function of its ROSTER level (the
// level it entered battle at — in-battle level-ups don't inflate the walk).
export type JpBaseFn = (level: number) => number;
export const defaultJpBase: JpBaseFn = (level) => Math.floor(10 + level / 4);

// The fraction of the earner's base that every OTHER roster unit earns.
export const SPILLOVER_FRACTION = 1 / 8;

export interface EarnOptions {
  readonly base?: JpBaseFn;
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
  const spillover = options.spilloverFraction ?? SPILLOVER_FRACTION;

  const levelOf = new Map<UnitId, number>();
  for (const u of roster) levelOf.set(u.id, u.level);

  const acc = new Map<UnitId, number>();
  const add = (id: UnitId, amount: number): void => {
    acc.set(id, (acc.get(id) ?? 0) + amount);
  };

  for (const action of actionLog) {
    if (action.type !== 'system_xp_award') continue;
    const recipient = action.payload.unitId;
    // Only awards to player-roster units generate JP (enemy leveling units
    // earn XP in-battle too — their awards are in the same log).
    const level = levelOf.get(recipient);
    if (level === undefined) continue;

    const b = base(level);
    add(recipient, b);
    const share = b * spillover;
    if (share > 0) {
      for (const other of roster) {
        if (other.id !== recipient) add(other.id, share);
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
