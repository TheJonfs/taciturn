// Tests for the battle-log export serializer (S74).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  advanceToNextEvent,
  commitAction,
  createInitialState,
  type GameState,
} from '@engine/index.ts';
import { demoBattle } from '@content/battles/demo.ts';
import { buildBattleLogDump, serializeBattleLog } from './action-log-export.ts';

// Drive the demo battle's opening scheduler events so the action log is
// non-empty (the first turn_start + any generated status ticks land in the
// ledger). Advancing the scheduler is only valid while no turn is in
// progress, so the guard naturally stops once the first turn opens — enough
// to exercise the serializer on a real, non-trivial log.
function statefulBattle(): GameState {
  const catalog = loadDefaultCatalog();
  let state = createInitialState(demoBattle, catalog);
  for (let i = 0; i < 4 && state.turnState === null; i++) {
    const sched = advanceToNextEvent(state, catalog);
    if (sched === null) break;
    const result = commitAction(sched.newState, sched.proposed, catalog);
    if (!result.ok) break;
    state = result.newState;
  }
  return state;
}

describe('serializeBattleLog', () => {
  it('produces valid JSON that round-trips', () => {
    const state = statefulBattle();
    const json = serializeBattleLog(state);
    expect(() => JSON.parse(json) as unknown).not.toThrow();
    const parsed = JSON.parse(json) as ReturnType<typeof buildBattleLogDump>;
    expect(parsed.header.battleId).toBe(state.battleId);
    expect(parsed.actionLog).toHaveLength(state.actionLog.length);
  });

  it('captures the replay header (seed, ruleset, teams, victory conditions)', () => {
    const state = statefulBattle();
    const dump = buildBattleLogDump(state);
    expect(dump.header.masterSeed).toBe(state.rng.masterSeed);
    expect(dump.header.rulesetId).toBe(String(state.ruleset.id));
    expect(dump.header.teams.length).toBe(state.teams.length);
    expect(dump.header.victoryConditions.length).toBe(state.victoryConditions.length);
    expect(dump.header.actionCount).toBe(state.actionLog.length);
    expect(dump.header.finalTick).toBe(state.tick);
  });

  it('reports a null outcome while the battle is ongoing', () => {
    const dump = buildBattleLogDump(statefulBattle());
    expect(dump.header.outcome).toBeNull();
  });

  it('includes the full ledger (every committed action)', () => {
    const state = statefulBattle();
    const dump = buildBattleLogDump(state);
    // The dump's log is the state's log verbatim — the complete trace.
    expect(dump.actionLog).toEqual(state.actionLog);
    expect(dump.actionLog.length).toBeGreaterThan(0);
  });
});
