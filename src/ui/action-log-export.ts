// Battle-log export (S74) — serialize a battle's full action ledger to a
// paste-ready JSON string for playtesting / debugging.
//
// `state.actionLog` is the complete mechanical trace: every committed
// Action with its stored `outcome` (damage, CT/MP/HP deltas, status ticks,
// non-firing reactions, KOs). Paired with the battle header — `battleId`,
// the RNG `masterSeed`, `rulesetId`, teams, victory conditions, final tick,
// and outcome — the dump captures the provenance needed to reproduce the
// battle deterministically against the same initial config (the engine is
// pure given `(initial state, action, seed)`).
//
// No `Map`/`Set` lives in the `Action` types, so `JSON.stringify` handles
// the log directly; branded ids are runtime primitives and serialize as
// their underlying string/number. Header ids are coerced via `String(...)`
// so the typed dump shape stays string-keyed (mirrors `team-export.ts`).
//
// Pure (no clock / no RNG) so the serializer is deterministically testable;
// the copy button supplies the side effect.

import type { Action, BattleOutcome, GameState, VictoryCondition } from '@engine/index.ts';

export interface BattleLogDumpHeader {
  readonly battleId: string;
  readonly masterSeed: number;
  readonly rulesetId: string;
  readonly map: { readonly width: number; readonly height: number };
  readonly teams: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly control: string;
  }>;
  readonly victoryConditions: ReadonlyArray<VictoryCondition>;
  readonly finalTick: number;
  // `null` while the battle is ongoing (mid-battle dumps are supported);
  // the Decided shape once `battle_end` has committed.
  readonly outcome: BattleOutcome | null;
  readonly actionCount: number;
}

export interface BattleLogDump {
  readonly header: BattleLogDumpHeader;
  readonly actionLog: ReadonlyArray<Action>;
}

// Assemble the structured dump (header + full ledger) from a battle state.
export function buildBattleLogDump(state: GameState): BattleLogDump {
  return {
    header: {
      battleId: state.battleId,
      masterSeed: state.rng.masterSeed,
      rulesetId: String(state.ruleset.id),
      map: { width: state.map.width, height: state.map.height },
      teams: state.teams.map((t) => ({
        id: String(t.id),
        name: t.name,
        control: String(t.control),
      })),
      victoryConditions: state.victoryConditions,
      finalTick: state.tick,
      outcome: state.outcome ?? null,
      actionCount: state.actionLog.length,
    },
    actionLog: state.actionLog,
  };
}

// Convenience — the copy button writes this string to the clipboard.
// 2-space indent matches `team-export.ts`'s paste-ready convention.
export function serializeBattleLog(state: GameState): string {
  return JSON.stringify(buildBattleLogDump(state), null, 2);
}
