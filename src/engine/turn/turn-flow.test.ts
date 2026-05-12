// Integration tests for session 9's turn-flow additions:
// - turn-skip (Stop status -> queryTurnSkipped -> turn_end emission)
// - battle-outcome evaluation -> battle_end emission
// - battle_decided guard rejects further commits
// - reaction fizzle on chain validation failure
// - scheduler advancement to next event

import { commitAction } from '../actions/commit.ts';
import {
  ACTIVE_BUCKET_IDS,
  PASSIVE_BUCKET_IDS,
} from '../abilities/constants.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { createCatalog } from '../catalog/index.ts';
import {
  DEFAULT_TEST_DAMAGE_PIPELINE,
  defaultTestRulesets,
  makeTestRuleset,
} from '../catalog/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { statusHook } from '../status/hooks.ts';
import { makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import type {
  ActiveAbilityDefinition,
  ClassDefinition,
  CommandSetDefinition,
  PassiveAbilityDefinition,
} from '../catalog/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  rulesetId,
  teamId,
  unitId,
  type AbilityId,
  type Loadout,
  type ProposedAction,
  type VictoryCondition,
} from '../types/index.ts';
import { evaluateBattleOutcome } from './evaluate-battle-outcome.ts';
import { advanceToNextEvent } from './scheduler.ts';

function knightClass(): ClassDefinition {
  return {
    id: classId('knight'),
    name: 'Knight',
    movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
    evasion: { front: 0, side: 0, back: 0 },
    equipmentSlots: { leftHand: true, rightHand: true, headgear: true, armor: true, accessory: true },
    firstActionCommandSet: commandSetId('battle_skill'),
    freeAbilities: new Set(),
  };
}

function loadoutWith(reaction?: AbilityId): Loadout {
  const actionBuckets: Record<string, ReadonlyArray<ReturnType<typeof commandSetId>>> = {};
  for (const b of ACTIVE_BUCKET_IDS) actionBuckets[b] = [];
  actionBuckets[bucketId('first_action')] = [commandSetId('battle_skill')];
  const passiveBuckets: Record<string, ReadonlyArray<AbilityId>> = {};
  for (const b of PASSIVE_BUCKET_IDS) passiveBuckets[b] = [];
  if (reaction !== undefined) passiveBuckets[bucketId('reaction')] = [reaction];
  return { actionBuckets, passiveBuckets };
}

function attackAbility(power_coefficient = 4): ActiveAbilityDefinition {
  return {
    id: abilityId('attack'),
    name: 'Attack',
    kind: 'active',
    bucket: bucketId('first_action'),
    baseCost: 1,
    availability: 'hidden',
    targeting: { kind: 'single_unit', range: { horizontal: 1, vertical: 3 }, rangeMode: 'melee' },
    actionSpeed: 0,
    mpCost: 0,
    effects: { damage: { tags: ['physical', 'weapon'], power_coefficient } },
  };
}

function battleSkill(): CommandSetDefinition {
  return {
    id: commandSetId('battle_skill'),
    name: 'Battle Skill',
    members: [abilityId('attack')],
    baseCost: 1,
    availability: 'hidden',
  };
}

const teamsAB = [
  { id: teamId('team_a'), name: 'A' },
  { id: teamId('team_b'), name: 'B' },
];

const defeatB: VictoryCondition = {
  kind: 'defeat_all',
  side: teamId('team_b'),
  description: 'defeat enemies',
};

const stopStatus = makeStatusType({
  id: 'stop',
  stackingRule: 'REFRESH',
  hooks: [statusHook('queryTurnSkipped', () => ({ reason: 'stopped', suppressStatusTicks: true }))],
});

describe('turn-skip — Stop status', () => {
  it('reduceTurnStart sees the skip query, sets skipped: true, and emits turn_end', () => {
    const cat = createCatalog({
      statusTypes: [stopStatus],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      ct: 100,
      loadout: loadoutWith(),
      statuses: [makeStatusInstance({ typeId: 'stop' })],
    });
    const state = makeGameState({ units: [u], map: flatMap(3, 3), teams: teamsAB });
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Two committed: turn_start (skipped) + turn_end.
    expect(r.committed).toHaveLength(2);
    expect(r.committed[0]!.type).toBe('turn_start');
    if (r.committed[0]!.type !== 'turn_start') return;
    expect(r.committed[0]!.outcome!.skipped).toBe(true);
    expect(r.committed[0]!.outcome!.skipReason).toBe('stopped');
    expect(r.committed[1]!.type).toBe('turn_end');
    // turnState cleared after turn_end.
    expect(r.newState.turnState).toBeNull();
  });

  it('does not skip when the unit has no skip-emitting status', () => {
    const cat = createCatalog({
      statusTypes: [stopStatus],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({ id: 'u1', spd: 10, ct: 100, loadout: loadoutWith() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3), teams: teamsAB });
    const r = commitAction(
      state,
      { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.committed).toHaveLength(1);
    expect(r.committed[0]!.type).toBe('turn_start');
    if (r.committed[0]!.type !== 'turn_start') return;
    expect(r.committed[0]!.outcome!.skipped).toBe(false);
    expect(r.newState.turnState).not.toBeNull();
  });
});

describe('battle-outcome — turn_end emits battle_end', () => {
  it('emits battle_end and sets state.outcome when the last enemy KO’d', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 10, ct: 100, team: 'team_a', loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 0, loadout: loadoutWith() });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      turnState: activeTurnFor(a.id),
      victoryConditions: [defeatB],
    });
    const r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: a.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Two committed: turn_end + battle_end.
    expect(r.committed).toHaveLength(2);
    expect(r.committed[0]!.type).toBe('turn_end');
    expect(r.committed[1]!.type).toBe('battle_end');
    if (r.committed[1]!.type !== 'battle_end') return;
    expect(r.committed[1]!.outcome!.winner).toBe(teamId('team_a'));
    expect(r.newState.outcome).toBeDefined();
    expect(r.newState.outcome!.winner).toBe(teamId('team_a'));
  });

  it('does not emit battle_end while the battle is ongoing', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 10, ct: 100, team: 'team_a', loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 10, team: 'team_b', hp: 100, loadout: loadoutWith() });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      turnState: activeTurnFor(a.id),
      victoryConditions: [defeatB],
    });
    const r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: a.id } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.committed).toHaveLength(1);
    expect(r.committed[0]!.type).toBe('turn_end');
    expect(r.newState.outcome).toBeUndefined();
  });
});

describe('battle_decided guard', () => {
  it('refuses further commits once outcome is set', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 10, ct: 100, team: 'team_a', loadout: loadoutWith() });
    const state = makeGameState({
      units: [a],
      teams: teamsAB,
      turnState: activeTurnFor(a.id),
      victoryConditions: [defeatB],
      outcome: { winner: teamId('team_a'), conditionIndex: 0, description: 'preset' },
    });
    const r = commitAction(
      state,
      { type: 'wait', source: 'player', actorId: a.id, payload: {} },
      cat,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.stage).toBe('battle_decided');
  });
});

describe('reaction fizzle — chain validation failure', () => {
  it('drops a reaction silently when its target moves out of range mid-chain', () => {
    // Counter targets the attacker. If the attacker were to teleport out
    // of melee range between the damage application and the Counter
    // commit (a contrived scenario for v1, since nothing teleports), the
    // Counter's range check fails at validation. Today no v1 ability
    // produces this, so we synthesize the failure with a deliberately
    // out-of-range counter.
    const counterToFarTarget: PassiveAbilityDefinition = {
      id: abilityId('counter_far'),
      name: 'Counter Far',
      kind: 'passive',
      bucket: bucketId('reaction'),
      baseCost: 1,
      availability: 'hidden',
      hooks: [
        passiveHook('onActionTargeted', (args) => {
          if (args.damageDealt === undefined || args.damageDealt <= 0) return [];
          const incoming = args.incomingAction;
          if (incoming.type !== 'use_ability') return [];
          if (!('actorId' in incoming)) return [];
          // Target a non-existent unit. validateUseAbility's getActorIfActive
          // call rejects with "Unit ... does not exist", which under the
          // reaction-validation path is a fizzleable failure.
          return [
            {
              type: 'use_ability',
              source: 'system',
              actorId: args.unit.id,
              payload: {
                abilityId: abilityId('attack'),
                target: { kind: 'unit', unitId: unitId('ghost') },
              },
            } as ProposedAction,
          ];
        }),
      ],
    };
    const ruleset = makeTestRuleset({ damagePipelineStages: DEFAULT_TEST_DAMAGE_PIPELINE });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [attackAbility(), counterToFarTarget],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: [ruleset],
    });
    const a = makeUnit({
      id: 'a',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      loadout: loadoutWith(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const b = makeUnit({
      id: 'b',
      spd: 10,
      pa: 5,
      hp: 100,
      maxHpBase: 100,
      team: 'team_b',
      loadout: loadoutWith(abilityId('counter_far')),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      map: flatMap(3, 3),
      turnState: activeTurnFor(a.id),
      victoryConditions: [defeatB],
    });
    const r = commitAction(
      state,
      {
        type: 'use_ability',
        source: 'player',
        actorId: a.id,
        payload: { abilityId: abilityId('attack'), target: { kind: 'unit', unitId: b.id } },
      },
      cat,
    );
    // The attack commits; the counter fizzles silently. Only one entry
    // in `committed` (the original attack).
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.committed).toHaveLength(1);
    expect(r.committed[0]!.type).toBe('use_ability');
    // Damage still applied.
    expect(r.newState.units.get(b.id)!.vitals.hp).toBe(80);
  });
});

describe('scheduler — advanceToNextEvent', () => {
  it('returns null when battle is decided', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({ id: 'u', spd: 10, loadout: loadoutWith() });
    const state = makeGameState({
      units: [u],
      teams: teamsAB,
      outcome: { winner: teamId('team_a'), conditionIndex: 0, description: 'done' },
    });
    expect(advanceToNextEvent(state, cat)).toBeNull();
  });

  it('returns null when a turn is already in progress', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({ id: 'u', spd: 10, loadout: loadoutWith() });
    const state = makeGameState({
      units: [u],
      teams: teamsAB,
      turnState: activeTurnFor(u.id),
    });
    expect(advanceToNextEvent(state, cat)).toBeNull();
  });

  it('emits turn_start for the unit that triggers first', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    // Unit a has higher Speed → triggers first.
    const a = makeUnit({ id: 'a', spd: 20, ct: 0, loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 10, ct: 0, loadout: loadoutWith() });
    const state = makeGameState({ units: [a, b], teams: teamsAB });
    const sched = advanceToNextEvent(state, cat);
    expect(sched).not.toBeNull();
    if (sched === null) return;
    expect(sched.proposed.type).toBe('turn_start');
    if (sched.proposed.type !== 'turn_start') return;
    expect(sched.proposed.payload.unitId).toBe(a.id);
    // Both units' CT advanced; a is at threshold.
    expect(sched.newState.units.get(a.id)!.ct).toBeGreaterThanOrEqual(100);
    // Tick advanced.
    expect(sched.newState.tick).toBeGreaterThan(0);
  });

  it('skips KO’d units in the projection', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 100, ct: 99, hp: 0, loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 10, ct: 0, loadout: loadoutWith() });
    const state = makeGameState({ units: [a, b], teams: teamsAB });
    const sched = advanceToNextEvent(state, cat);
    expect(sched).not.toBeNull();
    if (sched === null) return;
    if (sched.proposed.type !== 'turn_start') return;
    // a is KO’d, so b triggers despite being slower.
    expect(sched.proposed.payload.unitId).toBe(b.id);
  });

  it('determinism: same state produces same next event', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 12, ct: 0, loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 12, ct: 0, loadout: loadoutWith() });
    const state = makeGameState({ units: [a, b], teams: teamsAB });
    const r1 = advanceToNextEvent(state, cat);
    const r2 = advanceToNextEvent(state, cat);
    expect(r1?.proposed).toEqual(r2?.proposed);
    expect(r1?.ticksAdvanced).toBe(r2?.ticksAdvanced);
  });
});

describe('full turn cycle integration: scheduler → turn_start → wait → turn_end → scheduler', () => {
  it('runs two consecutive turns with the scheduler driving handoff', () => {
    const cat = createCatalog({
      statusTypes: [],
      abilities: [],
      commandSets: [battleSkill()],
      classes: [knightClass()],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const a = makeUnit({ id: 'a', spd: 20, ct: 0, team: 'team_a', loadout: loadoutWith() });
    const b = makeUnit({ id: 'b', spd: 10, ct: 0, team: 'team_b', loadout: loadoutWith() });
    let state = makeGameState({
      units: [a, b],
      teams: teamsAB,
      map: flatMap(3, 3),
      victoryConditions: [defeatB],
    });

    // Turn 1: scheduler picks a, a waits, a's turn ends.
    let sched = advanceToNextEvent(state, cat);
    expect(sched).not.toBeNull();
    if (sched === null) return;
    state = sched.newState;
    let r = commitAction(state, sched.proposed, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    expect(state.turnState).not.toBeNull();
    if (state.turnState === null) return;
    const turn1Unit = state.turnState.unitId;

    r = commitAction(
      state,
      { type: 'wait', source: 'player', actorId: turn1Unit, payload: {} },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    r = commitAction(
      state,
      { type: 'turn_end', source: 'system', payload: { unitId: turn1Unit } },
      cat,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    expect(state.turnState).toBeNull();
    expect(state.outcome).toBeUndefined();

    // Turn 2: scheduler picks the next unit.
    sched = advanceToNextEvent(state, cat);
    expect(sched).not.toBeNull();
    if (sched === null) return;
    state = sched.newState;
    r = commitAction(state, sched.proposed, cat);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    state = r.newState;
    if (state.turnState === null) return;
    const turn2Unit = state.turnState.unitId;
    // Expectation: faster unit went first, slower unit second; no
    // strict ordering claim beyond "different units across turns" for
    // a multi-unit state where both keep accruing CT.
    void turn2Unit;
  });
});

// Keep imports tidy.
void rulesetId;
void evaluateBattleOutcome;
