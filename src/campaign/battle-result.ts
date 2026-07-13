// TABA campaign — the result-summarizer (battle → per-unit deltas).
//
// The exit boundary (taba-m0-findings §C). The engine emits only
// `GameState.outcome` + a final-units map and does NOT act on them; this
// pure shell function walks that public final state and assembles the
// per-unit superset the campaign consumes. "Emit superset, consume subset":
// it emits what it can DERIVE from final state alone — survival, terminal
// fate, final vitals.
//
// Per-action JP is NOT summarized here: its roster-spillover reaches BENCHED
// units absent from the battle, so it needs the full durable roster — it runs
// at apply-back (which has the roster + the action log), not on this per-
// battle-unit summary. See `progression/earning.ts`.

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
      outcome: classify(unit.removed, unit.retreated, unit.vitals.hp),
      vitals: { hp: unit.vitals.hp, mp: unit.vitals.mp },
    });
  }

  return { outcome: finalState.outcome, units };
}

function classify(removed: boolean, retreated: boolean, hp: number): UnitOutcome {
  // Ch1 substrate: a death-protected retreat is a departure, not a
  // death — the unit left the field alive. Checked before `removed`
  // (retreat sets both flags) so a retreated unit is never classified
  // `lost`. Ch1 only retreats enemies (the recurring antagonist), but
  // the rule is side-agnostic by design: a retreated player unit must
  // not permadeath at apply-back.
  if (retreated) return 'survived';
  if (removed) return 'lost'; // permadeath precedence
  return hp > 0 ? 'survived' : 'downed';
}
