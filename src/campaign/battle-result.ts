// TABA campaign — the result-summarizer (battle → per-unit deltas).
//
// The exit boundary (taba-m0-findings §C). The engine emits only
// `GameState.outcome` + a final-units map and does NOT act on them; this
// pure shell function walks that public final state and assembles the
// per-unit superset the campaign consumes. "Emit superset, consume subset":
// M0 emits what it can DERIVE from final state alone — survival, terminal
// fate, final vitals. (M2 extends `UnitBattleSummary` with XP/JP once the
// battle TRACKS them; don't pre-build empty M2 fields now.)
//
// Reads ONLY public final state — no catalog, no engine internals (per the
// M0 acceptance criteria). The heal-to-full rule that needs the catalog
// lives in apply-back, not here.

import type { BattleOutcome, GameState, UnitId, Vitals } from '@engine/index.ts';

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
export function summarizeBattleResult(finalState: GameState): BattleResult {
  if (finalState.outcome === undefined) {
    throw new Error(
      'summarizeBattleResult: called on a non-terminal state (GameState.outcome is undefined)',
    );
  }

  const units = new Map<UnitId, UnitBattleSummary>();
  for (const unit of finalState.units.values()) {
    units.set(unit.id, {
      id: unit.id,
      outcome: classify(unit.removed, unit.vitals.hp),
      vitals: { hp: unit.vitals.hp, mp: unit.vitals.mp },
    });
  }

  return { outcome: finalState.outcome, units };
}

function classify(removed: boolean, hp: number): UnitOutcome {
  if (removed) return 'lost'; // permadeath precedence
  return hp > 0 ? 'survived' : 'downed';
}
