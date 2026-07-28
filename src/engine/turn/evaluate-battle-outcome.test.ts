// Tests for the battle-outcome evaluator. Pure function over GameState
// + Catalog (the `unit_below_hp` predicate reads effective max HP
// through the stat-query chain) — no RNG, no hooks fired. The
// reducer's wiring of `battle_end` emission is tested at the
// integration level (`turn-flow.test.ts`); the death-protection /
// retreat write path in `victory-conditions.test.ts`.

import { emptyCatalog, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  teamId,
  unitId,
  type Team,
  type VictoryCondition,
} from '../types/index.ts';
import { evaluateBattleOutcome } from './evaluate-battle-outcome.ts';

const A = teamId('team_a');
const B = teamId('team_b');
const teamsAB = [
  { id: A, name: 'A', control: 'human' },
  { id: B, name: 'B', control: 'ai' },
] satisfies readonly Team[];
const CATALOG = emptyCatalog();

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
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });

  it('returns decided when every unit on the named side is KO’d', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 0 });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      victoryConditions: [defeatBSide],
    });
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.winner).toBe(A);
    expect(out.decided.conditionIndex).toBe(0);
    expect(out.decided.description).toBe('defeat enemies');
    expect(out.decided.outcome).toBeUndefined();
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
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
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
    const out = evaluateBattleOutcome(state, CATALOG);
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
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided).toEqual(decided);
  });
});

// --- Ch1 substrate: the predicate grammar ---

describe('evaluateBattleOutcome — unit_below_hp (single unit)', () => {
  // makeUnit defaults maxHpBase to 100 with no equipment/status
  // modifiers, so hp is the percentage directly.
  const bossBelow15: VictoryCondition = {
    kind: 'predicate',
    predicate: {
      kind: 'unit_below_hp',
      target: { kind: 'unit', unitId: unitId('boss') },
      fraction: 0.15,
    },
    winner: A,
    description: 'boss driven off',
  };

  function stateWithBossAt(hp: number, extra?: { retreated?: boolean; removed?: boolean }) {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const boss = makeUnit({
      id: 'boss',
      spd: 10,
      team: 'team_b',
      hp,
      ...(extra?.retreated !== undefined ? { retreated: extra.retreated } : {}),
      ...(extra?.removed !== undefined ? { removed: extra.removed } : {}),
    });
    return makeGameState({
      units: [a, boss],
      teams: teamsAB,
      victoryConditions: [bossBelow15],
    });
  }

  it('is strict: exactly at the fraction is NOT below', () => {
    expect(evaluateBattleOutcome(stateWithBossAt(15), CATALOG)).toEqual({ kind: 'ongoing' });
  });

  it('fires just under the fraction, with the authored winner', () => {
    const out = evaluateBattleOutcome(stateWithBossAt(14), CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.winner).toBe(A);
  });

  it('a retreated unit counts as below any threshold', () => {
    const out = evaluateBattleOutcome(stateWithBossAt(0, { retreated: true, removed: true }), CATALOG);
    expect(out.kind).toBe('decided');
  });

  it('a KO’d unit counts as below any threshold', () => {
    expect(evaluateBattleOutcome(stateWithBossAt(0), CATALOG).kind).toBe('decided');
  });

  it('throws on an unknown unit id (authoring bug, fail loudly)', () => {
    const bad: VictoryCondition = {
      kind: 'predicate',
      predicate: {
        kind: 'unit_below_hp',
        target: { kind: 'unit', unitId: unitId('nobody') },
        fraction: 0.5,
      },
      winner: A,
      description: 'bad ref',
    };
    const state = makeGameState({
      units: [makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 })],
      teams: teamsAB,
      victoryConditions: [bad],
    });
    expect(() => evaluateBattleOutcome(state, CATALOG)).toThrow(/unknown unit/);
  });
});

describe('evaluateBattleOutcome — subdue (all_of: no_deaths + side below)', () => {
  const subdueGood: VictoryCondition = {
    kind: 'predicate',
    predicate: {
      kind: 'all_of',
      predicates: [
        { kind: 'no_deaths', side: B },
        { kind: 'unit_below_hp', target: { kind: 'side', side: B }, fraction: 0.25 },
      ],
    },
    winner: A,
    outcome: 'ester-good',
    description: 'all enemies subdued without a death',
  };
  const standardWin: VictoryCondition = {
    kind: 'predicate',
    predicate: { kind: 'all_defeated', side: B },
    winner: A,
    outcome: 'ester-standard',
    description: 'enemies defeated',
  };

  function subdueState(
    enemies: ReadonlyArray<{ id: string; hp: number; hasDied?: boolean }>,
  ) {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const bs = enemies.map((e) =>
      makeUnit({
        id: e.id,
        spd: 10,
        team: 'team_b',
        hp: e.hp,
        ...(e.hasDied !== undefined ? { hasDied: e.hasDied } : {}),
      }),
    );
    return makeGameState({
      units: [a, ...bs],
      teams: teamsAB,
      victoryConditions: [subdueGood, standardWin],
    });
  }

  it('stays ongoing while any enemy is at or above the threshold', () => {
    const state = subdueState([
      { id: 'b1', hp: 20 },
      { id: 'b2', hp: 25 }, // exactly 25% — strict, not subdued
    ]);
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });

  it('ends the battle with the good outcome tag when all are subdued and none died', () => {
    const state = subdueState([
      { id: 'b1', hp: 20 },
      { id: 'b2', hp: 1 },
    ]);
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.conditionIndex).toBe(0);
    expect(out.decided.outcome).toBe('ester-good');
    expect(out.decided.winner).toBe(A);
  });

  it('a single death makes good permanently unsatisfiable — falls through to standard', () => {
    // b1 died (revived or not — hasDied persists); b2 subdued. Good
    // can never fire; the fight only ends when everyone is down.
    const ongoing = subdueState([
      { id: 'b1', hp: 0, hasDied: true },
      { id: 'b2', hp: 10 },
    ]);
    expect(evaluateBattleOutcome(ongoing, CATALOG)).toEqual({ kind: 'ongoing' });

    const finished = subdueState([
      { id: 'b1', hp: 0, hasDied: true },
      { id: 'b2', hp: 0, hasDied: true },
    ]);
    const out = evaluateBattleOutcome(finished, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.conditionIndex).toBe(1);
    expect(out.decided.outcome).toBe('ester-standard');
  });

  it('a revived unit still counts as having died (hasDied persists past revival)', () => {
    // b1 was KO’d and raised back to 30% — alive and above threshold,
    // but no_deaths is already broken for good.
    const state = subdueState([
      { id: 'b1', hp: 30, hasDied: true },
      { id: 'b2', hp: 10 },
    ]);
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });
});

describe('evaluateBattleOutcome — subdue-leader (no_deaths + single unit below)', () => {
  const leaderGood: VictoryCondition = {
    kind: 'predicate',
    predicate: {
      kind: 'all_of',
      predicates: [
        { kind: 'no_deaths', side: B },
        { kind: 'unit_below_hp', target: { kind: 'unit', unitId: unitId('leader') }, fraction: 0.25 },
      ],
    },
    winner: A,
    outcome: 'ruk-good',
    description: 'leader subdued, no rebel deaths',
  };

  it('only the leader need be under the threshold; other units may be healthy', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const leader = makeUnit({ id: 'leader', spd: 10, team: 'team_b', hp: 24 });
    const rebel = makeUnit({ id: 'rebel', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [a, leader, rebel],
      teams: teamsAB,
      victoryConditions: [leaderGood],
    });
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.outcome).toBe('ruk-good');
  });

  it('a rebel death (not the leader) still breaks the good outcome', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const leader = makeUnit({ id: 'leader', spd: 10, team: 'team_b', hp: 24 });
    const rebel = makeUnit({ id: 'rebel', spd: 10, team: 'team_b', hp: 0, hasDied: true });
    const state = makeGameState({
      units: [a, leader, rebel],
      teams: teamsAB,
      victoryConditions: [leaderGood],
    });
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });
});

// --- S100 (Ch1 iteration Fix 2): unit_lost — the plot-unit loss predicate ---

describe('evaluateBattleOutcome — unit_lost', () => {
  // Loss condition as the campaign composes it: enemy team wins when any
  // listed unit is permadeath-removed.
  const lumenOrChrisLost: VictoryCondition = {
    kind: 'predicate',
    predicate: { kind: 'unit_lost', anyOf: [unitId('lumen'), unitId('chris')] },
    winner: B,
    description: 'a leader has fallen',
  };

  it('stays ongoing while a listed unit is merely KO’d (revival window open)', () => {
    const lumen = makeUnit({ id: 'lumen', spd: 10, team: 'team_a', hp: 0, turnsKOd: 2 });
    const chris = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [lumen, chris, b],
      teams: teamsAB,
      victoryConditions: [lumenOrChrisLost],
    });
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });

  it('decides for the authored winner when a listed unit is permadeath-removed', () => {
    const lumen = makeUnit({ id: 'lumen', spd: 10, team: 'team_a', hp: 0, removed: true });
    const chris = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [lumen, chris, b],
      teams: teamsAB,
      victoryConditions: [lumenOrChrisLost],
    });
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.winner).toBe(B);
    expect(out.decided.description).toBe('a leader has fallen');
  });

  it('any-of semantics: the SECOND listed unit lost also decides', () => {
    const lumen = makeUnit({ id: 'lumen', spd: 10, team: 'team_a', hp: 100 });
    const chris = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 0, removed: true });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [lumen, chris, b],
      teams: teamsAB,
      victoryConditions: [lumenOrChrisLost],
    });
    const out = evaluateBattleOutcome(state, CATALOG);
    expect(out.kind).toBe('decided');
    if (out.kind !== 'decided') return;
    expect(out.decided.winner).toBe(B);
  });

  it('a death-protected RETREAT is not a loss (removed but retreated)', () => {
    const lumen = makeUnit({
      id: 'lumen',
      spd: 10,
      team: 'team_a',
      hp: 0,
      removed: true,
      retreated: true,
    });
    const chris = makeUnit({ id: 'chris', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [lumen, chris, b],
      teams: teamsAB,
      victoryConditions: [lumenOrChrisLost],
    });
    expect(evaluateBattleOutcome(state, CATALOG)).toEqual({ kind: 'ongoing' });
  });

  it('throws loudly on an unknown unit id (authoring typo)', () => {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100 });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      victoryConditions: [
        {
          kind: 'predicate',
          predicate: { kind: 'unit_lost', anyOf: [unitId('nobody')] },
          winner: B,
          description: 'typo',
        },
      ],
    });
    expect(() => evaluateBattleOutcome(state, CATALOG)).toThrow(/unknown unit/);
  });
});
