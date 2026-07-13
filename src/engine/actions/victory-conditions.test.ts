// Ch1 substrate integration tests: death protection (retreat instead of
// KO), battle-scoped death tracking, and the predicate victory grammar
// firing through the real commit loop (post-commit checkpoint,
// generated system_unit_removed, battle_end reduction).
//
// The evaluator's predicate semantics are unit-tested in
// `engine/turn/evaluate-battle-outcome.test.ts`; these tests pin the
// reducer-side writes and the end-to-end decide path.

import { emptyCatalog, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { teamId, unitId, type Team, type VictoryCondition } from '../types/index.ts';
import { commitAction } from './commit.ts';

const A = teamId('team_a');
const B = teamId('team_b');
const teamsAB = [
  { id: A, name: 'A', control: 'human' },
  { id: B, name: 'B', control: 'ai' },
] satisfies readonly Team[];
const CATALOG = emptyCatalog();

function lethalHit(targetId: ReturnType<typeof unitId>, amount: number) {
  return {
    type: 'system_damage',
    source: 'system',
    payload: {
      targetId,
      amount,
      tags: ['physical'],
      source: { kind: 'falling', unitId: targetId, dropDistance: 5 },
    },
  } as const;
}

describe('death protection — lethal hit retreats instead of KO', () => {
  it('sets retreated + removed (via system_unit_removed), never hasDied', () => {
    const boss = makeUnit({
      id: 'boss', spd: 10, team: 'team_b', hp: 20, deathProtected: true,
    });
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const state = makeGameState({ units: [a, boss], teams: teamsAB });

    const r = commitAction(state, lethalHit(boss.id, 50), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const after = r.newState.units.get(boss.id)!;
    expect(after.vitals.hp).toBe(0);
    expect(after.retreated).toBe(true);
    expect(after.removed).toBe(true); // flipped by the generated system_unit_removed
    expect(after.hasDied).toBe(false); // retreat ≠ death

    const removal = r.committed.find((c) => c.type === 'system_unit_removed');
    expect(removal).toBeDefined();
    expect(removal!.payload).toMatchObject({ targetId: boss.id, reason: 'retreated' });
  });

  it('a NON-lethal hit on a protected unit is a plain damage write', () => {
    const boss = makeUnit({
      id: 'boss', spd: 10, team: 'team_b', hp: 20, deathProtected: true,
    });
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const state = makeGameState({ units: [a, boss], teams: teamsAB });

    const r = commitAction(state, lethalHit(boss.id, 5), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(boss.id)!;
    expect(after.vitals.hp).toBe(15);
    expect(after.retreated).toBe(false);
    expect(after.removed).toBe(false);
  });

  it('an unprotected unit KO’d by the same hit records hasDied', () => {
    const grunt = makeUnit({ id: 'grunt', spd: 10, team: 'team_b', hp: 20 });
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const state = makeGameState({ units: [a, grunt], teams: teamsAB });

    const r = commitAction(state, lethalHit(grunt.id, 50), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.newState.units.get(grunt.id)!;
    expect(after.vitals.hp).toBe(0);
    expect(after.hasDied).toBe(true);
    expect(after.retreated).toBe(false);
    expect(after.removed).toBe(false); // permadeath is the scheduler's, later
  });
});

describe('boss threshold / lethal-hit victory (nodes 3 & 8 shape)', () => {
  const bossCondition: VictoryCondition = {
    kind: 'predicate',
    predicate: {
      kind: 'unit_below_hp',
      target: { kind: 'unit', unitId: unitId('boss') },
      fraction: 0.15,
    },
    winner: A,
    description: 'the antagonist withdraws',
  };

  function bossState(bossHp: number) {
    const boss = makeUnit({
      id: 'boss', spd: 10, team: 'team_b', hp: bossHp, deathProtected: true,
    });
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    return makeGameState({
      units: [a, boss],
      teams: teamsAB,
      victoryConditions: [bossCondition],
    });
  }

  it('whittling the boss under the threshold ends the battle; boss alive', () => {
    // 20 → 10 of maxHp 100: crosses under 15% without a KO.
    const r = commitAction(bossState(20), lethalHit(unitId('boss'), 10), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.winner).toBe(A);
    const boss = r.newState.units.get(unitId('boss'))!;
    expect(boss.vitals.hp).toBe(10); // survives — the scene explains the exit
    expect(boss.retreated).toBe(false);
  });

  it('a lethal hit straight through protection also ends the battle (retreated counts as below)', () => {
    const r = commitAction(bossState(80), lethalHit(unitId('boss'), 999), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.winner).toBe(A);
    const boss = r.newState.units.get(unitId('boss'))!;
    expect(boss.retreated).toBe(true);
    expect(boss.hasDied).toBe(false);
  });
});

describe('subdue victory (nodes 9 & 10 shape) — ends the battle with the outcome tag', () => {
  const good: VictoryCondition = {
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
    description: 'all subdued, none dead',
  };
  const standard: VictoryCondition = {
    kind: 'predicate',
    predicate: { kind: 'all_defeated', side: B },
    winner: A,
    outcome: 'ester-standard',
    description: 'all enemies defeated',
  };

  function subdueState(b1Hp: number, b2Hp: number, b1HasDied = false) {
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const b1 = makeUnit({ id: 'b1', spd: 10, team: 'team_b', hp: b1Hp, hasDied: b1HasDied });
    const b2 = makeUnit({ id: 'b2', spd: 10, team: 'team_b', hp: b2Hp });
    return makeGameState({
      units: [a, b1, b2],
      teams: teamsAB,
      victoryConditions: [good, standard],
    });
  }

  it('the hit that subdues the last enemy ENDS the battle as the good outcome', () => {
    // b1 already subdued (20%), b2 at 30% takes 10 → 20%: both below,
    // nobody died — battle over, tag recorded on state.outcome.
    const r = commitAction(subdueState(20, 30), lethalHit(unitId('b2'), 10), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.outcome).toBe('ester-good');
    expect(r.newState.outcome!.winner).toBe(A);
    // Both enemies alive — subdued, not killed.
    expect(r.newState.units.get(unitId('b1'))!.vitals.hp).toBeGreaterThan(0);
    expect(r.newState.units.get(unitId('b2'))!.vitals.hp).toBeGreaterThan(0);
  });

  it('the killing blow that would ALSO satisfy subdue counts as a death first', () => {
    // b1 subdued; the hit takes b2 from 30 straight to 0. hasDied is
    // written by the same commit the checkpoint evaluates — good is
    // broken in the very action that lowered everyone below threshold.
    const r = commitAction(subdueState(20, 30), lethalHit(unitId('b2'), 999), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeUndefined(); // b1 still stands — fight continues
  });

  it('after a death, killing the rest ends as the standard outcome', () => {
    const r = commitAction(subdueState(20, 0, false), lethalHit(unitId('b1'), 999), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.outcome).toBe('ester-standard');
  });

  it('a protected unit retreating does NOT break no_deaths (retreat ≠ death)', () => {
    // Hybrid shape a future node might author: a protected captain among
    // subdue targets. Lethal-hitting the captain retreats him (below
    // threshold, no death) while b2 is already subdued → good fires.
    const a = makeUnit({ id: 'a', spd: 10, team: 'team_a', hp: 100 });
    const captain = makeUnit({
      id: 'captain', spd: 10, team: 'team_b', hp: 80, deathProtected: true,
    });
    const b2 = makeUnit({ id: 'b2', spd: 10, team: 'team_b', hp: 20 });
    const state = makeGameState({
      units: [a, captain, b2],
      teams: teamsAB,
      victoryConditions: [good, standard],
    });
    const r = commitAction(state, lethalHit(unitId('captain'), 999), CATALOG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.outcome).toBe('ester-good');
  });
});
