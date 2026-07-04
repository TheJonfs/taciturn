// TABA campaign — the result-summarizer (battle → per-unit deltas).
//
// The exit boundary (taba-m0-findings §C). The engine emits only
// `GameState.outcome` + a final-units map and does NOT act on them; this
// pure shell function walks that public final state and assembles the
// per-unit superset the campaign consumes. "Emit superset, consume subset":
// M0 emits what it can DERIVE from final state alone — survival, terminal
// fate, final vitals.
//
// M2 (per-action JP): `earnedJp` is added here WITH its producer — the field
// and the `computeEarnedJp` action-log read land together, honoring the S80
// "don't pre-build empty M2 fields" rule. Earning reads `finalState.actionLog`
// (public final state), so this stays catalog-free; only roster units bank it
// (apply-back matches by id). The heal-to-full rule that needs the catalog
// still lives in apply-back, not here.

import type { BattleOutcome, GameState, UnitId, Vitals } from '@engine/index.ts';
import { computeEarnedJp, type EarnOptions } from './progression/index.ts';

// Terminal classification of a unit from final battle state (D-D):
//   - `survived` — `hp > 0`.
//   - `downed`   — KO'd but not removed (`hp <= 0 && !removed`).
//   - `lost`     — permadeath-removed (`removed === true`, S39a). Takes
//     precedence over hp (a removed unit is lost regardless of its hp).
export type UnitOutcome = 'survived' | 'downed' | 'lost';

export interface UnitBattleSummary {
  readonly id: UnitId;
  readonly outcome: UnitOutcome;
  readonly vitals: Vitals; // final hp/mp as the battle left them
  // JP this unit earned in the battle (per-action, from the action log).
  // Banked into the durable ledger by apply-back — but only for roster units
  // that stayed active (a `lost` unit banks nothing).
  readonly earnedJp: number;
}

export interface BattleResult {
  // The decided battle outcome (winner + which condition fired). Present
  // only on a terminal state — summarizing an ongoing battle is a bug.
  readonly outcome: BattleOutcome;
  // Per-unit summary for EVERY unit in final state, keyed by id. Apply-back
  // consumes the player-roster subset by id; enemy entries are ignored.
  // (A `Map` is fine — `BattleResult` is transient, never serialized; only
  // `CampaignState` is the save target.)
  readonly units: ReadonlyMap<UnitId, UnitBattleSummary>;
}

// Summarize a TERMINAL battle state into the per-unit superset + outcome.
// Throws if the battle hasn't decided (no `outcome`) — fail loud rather
// than fabricate a result from a mid-battle snapshot.
export function summarizeBattleResult(
  finalState: GameState,
  earnOptions?: EarnOptions,
): BattleResult {
  if (finalState.outcome === undefined) {
    throw new Error(
      'summarizeBattleResult: called on a non-terminal state (GameState.outcome is undefined)',
    );
  }

  // Per-action JP from the action log. Tunable via `earnOptions` (the
  // mid-session rate/predicate injection seam); defaults to the working anchor.
  const earned = computeEarnedJp(finalState.actionLog, earnOptions);

  const units = new Map<UnitId, UnitBattleSummary>();
  for (const unit of finalState.units.values()) {
    units.set(unit.id, {
      id: unit.id,
      outcome: classify(unit.removed, unit.vitals.hp),
      vitals: { hp: unit.vitals.hp, mp: unit.vitals.mp },
      earnedJp: earned.get(unit.id) ?? 0,
    });
  }

  return { outcome: finalState.outcome, units };
}

function classify(removed: boolean, hp: number): UnitOutcome {
  if (removed) return 'lost'; // permadeath precedence
  return hp > 0 ? 'survived' : 'downed';
}
