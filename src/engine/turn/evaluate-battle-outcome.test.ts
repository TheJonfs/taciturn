// Tests for the battle-outcome evaluator. Pure function over GameState
// — no catalog dependency, no RNG, no hooks. The reducer's wiring of
// `battle_end` emission is tested at the integration level
// (`turn-flow.test.ts`).

import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { teamId, unitId, type VictoryCondition } from '../types/index.ts';
import { evaluateBattleOutcome } from './evaluate-battle-outcome.ts';

const A = teamId('team_a');
const B = teamId('team_b');
const teamsAB = [
  { id: A, name: 'A', control: 'human' },
  { id: B, name: 'B', control: 'ai' },
];

const defeatBSide: VictoryCondition = {
  kind: 'defeat_all',
  side: B,
  description: 'defeat enemies',
};

describe('evaluateBattleOutcome — defeat_all', () => {
  it('returns ongoing when the named side has at least one living unit', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      victoryConditions: [defeatBSide],
    });
    expect(evaluateBattleOutcome(state)).toEqual({ kind: 'ongoing' });
  });

  it('returns decided when every unit on the named side is KO’d', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 0 });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      victoryConditions: [defeatBSide],
    });
    const out = evaluateBattleOutcome(state);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.winner).toBe(A);
    expect(out.decided.conditionIndex).toBe(0);
    expect(out.decided.description).toBe('defeat enemies');
  });

  it('survives one alive enemy among many KO’d', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b1 = makeUnit({ id: 'b1', spd: 10, team: 'team_b', hp: 0 });
    const b2 = makeUnit({ id: 'b2', spd: 10, team: 'team_b', hp: 1 });
    const b3 = makeUnit({ id: 'b3', spd: 10, team: 'team_b', hp: 0 });
    const state = makeGameState({
      units: [a, b1, b2, b3],
      teams: teamsAB,
      victoryConditions: [defeatBSide],
    });
    expect(evaluateBattleOutcome(state)).toEqual({ kind: 'ongoing' });
  });
});

describe('evaluateBattleOutcome — first satisfied wins', () => {
  it('returns the first satisfied condition when multiple would satisfy', () => {
    // Both teams are KO’d. Whichever condition is listed first wins.
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 0 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 0 });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      victoryConditions: [
        { kind: 'defeat_all', side: A, description: 'A defeated' },
        { kind: 'defeat_all', side: B, description: 'B defeated' },
      ],
    });
    const out = evaluateBattleOutcome(state);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.conditionIndex).toBe(0);
    expect(out.decided.winner).toBe(B);
  });
});

describe('evaluateBattleOutcome — already-decided pass-through', () => {
  it('returns the existing outcome when state.outcome is set', () => {
    const decided = {
      winner: A,
      conditionIndex: 0,
      description: 'preserved',
    };
    const state = makeGameState({
      units: [makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 0 })],
      teams: teamsAB,
      victoryConditions: [defeatBSide],
      outcome: decided,
    });
    const out = evaluateBattleOutcome(state);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided).toEqual(decided);
  });
});

// Keep imports tidy.
void unitId;
