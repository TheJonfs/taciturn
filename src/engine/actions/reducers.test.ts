// Tests for the per-kind reducer branches. Each branch is a pure
// function: same (state, action, catalog) yields the same ReduceResult.

import {
  knightLoadout,
  makeAbilitiesCatalog,
  makeActive,
} from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeChargedAction, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap } from '../map/test-fixtures.ts';
import { catalogWith, makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  chargedActionId,
  commandSetId,
  rulesetId,
  statusTypeId,
  unitId,
  type Action,
  type ChargedAction,
} from '../types/index.ts';
import { reduce } from './reduce.ts';
import { reduceMove, reduceSetFacing, reduceStatusTick, reduceTurnEnd, reduceTurnStart, reduceUseAbility, reduceWait } from './reducers.ts';
import { createCatalog } from '../catalog/index.ts';
import { defaultTestRulesets } from '../catalog/test-fixtures.ts';
import { knightLoadout as knightLoadoutImported } from '../abilities/test-fixtures.ts';

// Build a fully-formed Action (envelope filled in) for direct reducer
// testing. Tests typically don't go through the seed pipeline; they
// pass canned envelopes.
function asAction<T extends Action['type']>(
  type: T,
  envelope: {
    readonly sequenceNumber: number;
    readonly actorId?: string;
    readonly seed?: number;
  },
  payload: Extract<Action, { type: T }>['payload'],
): Extract<Action, { type: T }> {
  const env = {
    sequenceNumber: envelope.sequenceNumber,
    source: 'player' as const,
    timestamp: { tick: 0, ct: 0 },
    seed: envelope.seed ?? 0,
    chainDepth: 0,
    isReaction: false,
    ...(envelope.actorId !== undefined ? { actorId: unitId(envelope.actorId) } : {}),
  };
  return { ...env, type, payload } as Extract<Action, { type: T }>;
}

void knightLoadoutImported;

describe('reduceMove', () => {
  it('moves the unit, decrements move budget, increments consumed', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(5, 5),
      turnState: activeTurnFor(u.id),
    });
    const action = asAction('move', { sequenceNumber: 1, actorId: 'u1' }, {
      destination: { x: 1, y: 0, layer: 0 },
    });
    const { newState, outcome } = reduceMove(state, action, cat);
    const newUnit = newState.units.get(u.id)!;
    expect(newUnit.position).toEqual({ x: 1, y: 0, layer: 0 });
    expect(outcome.kind).toBe('move');
    expect(outcome.finalPosition).toEqual({ x: 1, y: 0, layer: 0 });
    expect(newState.turnState!.budget.movesAvailable).toBe(0);
    expect(newState.turnState!.consumed.movesConsumed).toBe(1);
  });

  it('updates facing based on the last step direction', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      facing: 'N',
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(5, 5),
      turnState: activeTurnFor(u.id),
    });
    const action = asAction('move', { sequenceNumber: 1, actorId: 'u1' }, {
      destination: { x: 0, y: 1, layer: 0 },
    });
    const { newState } = reduceMove(state, action, cat);
    expect(newState.units.get(u.id)!.facing).toBe('S');
  });
});

describe('reduceWait', () => {
  it('zeroes the budget and marks waited', () => {
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('wait', { sequenceNumber: 1, actorId: 'u1' }, {});
    const { newState } = reduceWait(state, action);
    expect(newState.turnState!.budget).toEqual({ movesAvailable: 0, actsAvailable: 0 });
    expect(newState.turnState!.consumed.waited).toBe(true);
  });
});

describe('reduceSetFacing', () => {
  it('updates the unit facing and reports the transition', () => {
    const u = makeUnit({ id: 'u1', spd: 10, facing: 'N', loadout: knightLoadout() });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('set_facing', { sequenceNumber: 1, actorId: 'u1' }, {
      facing: 'E',
    });
    const { newState, outcome } = reduceSetFacing(state, action);
    expect(newState.units.get(u.id)!.facing).toBe('E');
    expect(outcome).toEqual({ kind: 'set_facing', from: 'N', to: 'E' });
  });
});

describe('reduceUseAbility — instant + status-application', () => {
  it('applies a self-targeting status effect', () => {
    const haste = makeStatusType({
      id: 'haste',
      stackingRule: 'REFRESH',
      defaultMagnitude: 1.5,
    });
    const battleCry = makeActive({
      id: 'battle_cry',
      targeting: { kind: 'self' },
      effects: {
        statusEffects: [{ typeId: statusTypeId('haste'), target: 'caster', duration: 30 }],
      },
    });
    // Build a catalog with the status type AND the test ability.
    const cat = createCatalog({
      statusTypes: [haste],
      abilities: [battleCry],
      commandSets: [{ id: commandSetId('battle_skill'), name: 'Battle Skill', members: [], baseCost: 1 }],
      classes: [
        {
          id: { __brand: 'ClassId' } as never,
          name: 'Knight',
          movement: { moveRange: 3, jump: 2, terrainCosts: new Map(), canEnter: new Set(['ground']) },
          firstActionCommandSet: commandSetId('battle_skill'),
          freeAbilities: new Set(),
        } as Parameters<typeof createCatalog>[0]['classes'][number],
      ],
      items: [],
      rulesets: defaultTestRulesets,
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
    });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('use_ability', { sequenceNumber: 1, actorId: 'u1' }, {
      abilityId: abilityId('battle_cry'),
      target: { kind: 'self' },
    });
    const { newState, outcome } = reduceUseAbility(state, action, cat);
    const newUnit = newState.units.get(u.id)!;
    expect(newUnit.statuses).toHaveLength(1);
    expect(newUnit.statuses[0]!.typeId).toBe(statusTypeId('haste'));
    expect(outcome.perTargetResults[0]!.statusesApplied).toBeDefined();
    expect(newState.turnState!.budget.actsAvailable).toBe(0);
    expect(newState.turnState!.consumed.actsConsumed).toBe(1);
  });

  it('deducts MP cost', () => {
    const expensive = makeActive({
      id: 'expensive',
      targeting: { kind: 'self' },
      mpCost: 4,
    });
    const cat = makeAbilitiesCatalog({ abilities: [expensive] });
    const u = makeUnit({ id: 'u1', spd: 10, mp: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('use_ability', { sequenceNumber: 1, actorId: 'u1' }, {
      abilityId: abilityId('expensive'),
      target: { kind: 'self' },
    });
    const { newState, outcome } = reduceUseAbility(state, action, cat);
    expect(newState.units.get(u.id)!.vitals.mp).toBe(6);
    expect(outcome.mpSpent).toBe(4);
  });

  it('throws when chargeTicks > 0 (deferred until the first content consumer)', () => {
    const slowSpell = makeActive({
      id: 'slow_spell',
      targeting: { kind: 'self' },
      chargeTicks: 50,
    });
    const cat = makeAbilitiesCatalog({ abilities: [slowSpell] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('use_ability', { sequenceNumber: 1, actorId: 'u1' }, {
      abilityId: abilityId('slow_spell'),
      target: { kind: 'self' },
    });
    expect(() => reduceUseAbility(state, action, cat)).toThrow(/chargeTicks/);
  });
});

describe('reduceTurnStart', () => {
  it('sets up the active turn with the rulesets default budget', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const action = asAction('turn_start', { sequenceNumber: 1 }, { unitId: u.id });
    const { newState } = reduceTurnStart(state, action, cat);
    expect(newState.turnState).not.toBeNull();
    expect(newState.turnState!.unitId).toBe(u.id);
    expect(newState.turnState!.budget).toEqual({ movesAvailable: 1, actsAvailable: 1 });
  });

  it('emits status_tick actions for each per-unit-CT status on the unit', () => {
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = catalogWith([poison]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 3 })],
    });
    const state = makeGameState({ units: [u] });
    const action = asAction('turn_start', { sequenceNumber: 1 }, { unitId: u.id });
    const { generatedActions } = reduceTurnStart(state, action, cat);
    expect(generatedActions).toHaveLength(1);
    expect(generatedActions[0]!.type).toBe('status_tick');
  });
});

describe('reduceTurnEnd', () => {
  it("subtracts the rulesets full Move+Act CT cost when both consumed", () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, ct: 110, loadout: knightLoadout() });
    const turn = {
      ...activeTurnFor(u.id),
      consumed: { movesConsumed: 1, actsConsumed: 1, waited: false },
    };
    const state = makeGameState({ units: [u], turnState: turn });
    const action = asAction('turn_end', { sequenceNumber: 1 }, { unitId: u.id });
    const { newState, outcome } = reduceTurnEnd(state, action, cat);
    expect(outcome.ctSpent).toBe(100);
    expect(newState.units.get(u.id)!.ct).toBe(10);
    expect(newState.turnState).toBeNull();
  });

  it("subtracts the rulesets Move-only CT cost when only Move consumed", () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, ct: 100, loadout: knightLoadout() });
    const turn = {
      ...activeTurnFor(u.id),
      consumed: { movesConsumed: 1, actsConsumed: 0, waited: false },
    };
    const state = makeGameState({ units: [u], turnState: turn });
    const action = asAction('turn_end', { sequenceNumber: 1 }, { unitId: u.id });
    const { outcome } = reduceTurnEnd(state, action, cat);
    expect(outcome.ctSpent).toBe(50); // default ruleset moveOnly
  });

  it('uses Wait CT cost when nothing consumed', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, ct: 100, loadout: knightLoadout() });
    const turn = {
      ...activeTurnFor(u.id),
      consumed: { movesConsumed: 0, actsConsumed: 0, waited: true },
    };
    const state = makeGameState({ units: [u], turnState: turn });
    const action = asAction('turn_end', { sequenceNumber: 1 }, { unitId: u.id });
    const { outcome } = reduceTurnEnd(state, action, cat);
    expect(outcome.ctSpent).toBe(20);
  });
});

describe('reduceStatusTick', () => {
  it('decrements duration', () => {
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = catalogWith([poison]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 3 })],
    });
    const state = makeGameState({ units: [u] });
    const action = asAction('status_tick', { sequenceNumber: 1 }, {
      unitId: u.id,
      statusTypeId: statusTypeId('poison'),
    });
    const { newState, outcome } = reduceStatusTick(state, action, cat);
    expect(newState.units.get(u.id)!.statuses[0]!.remainingDuration).toBe(2);
    expect(outcome.removed).toBe(false);
  });

  it('removes the status when duration hits 0', () => {
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = catalogWith([poison]);
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'poison', remainingDuration: 1 })],
    });
    const state = makeGameState({ units: [u] });
    const action = asAction('status_tick', { sequenceNumber: 1 }, {
      unitId: u.id,
      statusTypeId: statusTypeId('poison'),
    });
    const { newState, outcome } = reduceStatusTick(state, action, cat);
    expect(newState.units.get(u.id)!.statuses).toHaveLength(0);
    expect(outcome.removed).toBe(true);
  });

  it('is a no-op when the status is no longer present', () => {
    const poison = makeStatusType({ id: 'poison', stackingRule: 'REFRESH' });
    const cat = catalogWith([poison]);
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const action = asAction('status_tick', { sequenceNumber: 1 }, {
      unitId: u.id,
      statusTypeId: statusTypeId('poison'),
    });
    const { newState, outcome } = reduceStatusTick(state, action, cat);
    expect(newState).toBe(state);
    expect(outcome.removed).toBe(false);
  });
});

describe('reducer dispatcher', () => {
  it('dispatches by action.type', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], turnState: activeTurnFor(u.id) });
    const action = asAction('wait', { sequenceNumber: 1, actorId: 'u1' }, {});
    const result = reduce(state, action, cat);
    expect(result.outcome.kind).toBe('wait');
  });
});

describe('reduceChargedActionResolve (skeleton)', () => {
  it('removes the charged action from the queue and returns an empty result list', () => {
    const cat = makeAbilitiesCatalog({});
    const ca: ChargedAction = makeChargedAction({ id: 'ca1', speed: 10 });
    const state = makeGameState({ chargedActions: [ca] });
    const action = asAction('charged_action_resolve', { sequenceNumber: 1 }, {
      chargedActionId: chargedActionId('ca1'),
    });
    const result = reduce(state, action, cat);
    expect(result.newState.chargedActions).toHaveLength(0);
  });
});

// Keep imports tidy.
void rulesetId;
void bucketId;
