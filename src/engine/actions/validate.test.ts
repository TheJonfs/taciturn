// Tests for validateAction. Two layers: universal invariants (actor
// exists, KO check, target bounds, resources non-negative) and contextual
// rules (TurnBudget, range/targeting checks).

import { knightLoadout, makeAbilitiesCatalog, makeActive } from '../abilities/test-fixtures.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { flatMap, mapWith } from '../map/test-fixtures.ts';
import {
  abilityId,
  bucketId,
  unitId,
  type ProposedAction,
} from '../types/index.ts';
import { validateAction } from './validate.ts';

function moveAction(actorId: string, x: number, y: number): ProposedAction {
  return {
    type: 'move',
    source: 'player',
    actorId: unitId(actorId),
    payload: { destination: { x, y, layer: 0 } },
  };
}

function useAbility(actorId: string, ability: string, targetUnitId?: string): ProposedAction {
  return {
    type: 'use_ability',
    source: 'player',
    actorId: unitId(actorId),
    payload: {
      abilityId: abilityId(ability),
      target:
        targetUnitId === undefined
          ? { kind: 'self' }
          : { kind: 'unit', unitId: unitId(targetUnitId) },
    },
  };
}

describe('validateAction — universal invariants', () => {
  it('rejects a Move when the actor does not exist', () => {
    const cat = makeAbilitiesCatalog({});
    const state = makeGameState({ map: flatMap(3, 3) });
    const result = validateAction(state, moveAction('ghost', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not exist/);
  });

  it("rejects a Move when the actor is KO'd", () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, hp: 0, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, moveAction('u1', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/KO/);
  });

  it('rejects an action when no turn is in progress', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    const result = validateAction(state, moveAction('u1', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no turn/i);
  });

  it("rejects an action when it's another unit's turn", () => {
    const cat = makeAbilitiesCatalog({});
    const u1 = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const u2 = makeUnit({ id: 'u2', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u1, u2],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u1.id),
    });
    const result = validateAction(state, moveAction('u2', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/active turn/i);
  });
});

describe('validateAction — Move', () => {
  it('accepts a legal in-range Move', () => {
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
    const result = validateAction(state, moveAction('u1', 1, 0), cat);
    expect(result.valid).toBe(true);
  });

  it('rejects a Move past the unit move range', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [u],
      map: flatMap(10, 10),
      turnState: activeTurnFor(u.id),
    });
    // Knight default moveRange is 3; (5, 0) is distance 5.
    const result = validateAction(state, moveAction('u1', 5, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not reachable/i);
  });

  it('rejects a Move when no movesAvailable in the budget', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, budget: { movesAvailable: 0, actsAvailable: 1 } },
    });
    const result = validateAction(state, moveAction('u1', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/move budget/i);
  });

  it('rejects a Move whose destination tile does not exist', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: mapWith({
        width: 3,
        height: 1,
        tiles: [
          { x: 0, y: 0 },
          // gap at (1, 0)
          { x: 2, y: 0 },
        ],
      }),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, moveAction('u1', 1, 0), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not exist/i);
  });
});

describe('validateAction — UseAbility', () => {
  it('accepts a self-targeting ability', () => {
    const selfBuff = makeActive({ id: 'self_buff', targeting: { kind: 'self' } });
    const cat = makeAbilitiesCatalog({ abilities: [selfBuff] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, useAbility('u1', 'self_buff'), cat);
    expect(result.valid).toBe(true);
  });

  it('rejects a self-targeting ability handed a unit target', () => {
    const selfBuff = makeActive({ id: 'self_buff', targeting: { kind: 'self' } });
    const cat = makeAbilitiesCatalog({ abilities: [selfBuff] });
    const u1 = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const u2 = makeUnit({ id: 'u2', spd: 10, loadout: knightLoadout(), position: { x: 1, y: 0, layer: 0 } });
    const state = makeGameState({
      units: [u1, u2],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u1.id),
    });
    const result = validateAction(state, useAbility('u1', 'self_buff', 'u2'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/self only/i);
  });

  it('rejects when the ability is unknown', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, useAbility('u1', 'phantom'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unknown ability/i);
  });

  it("rejects when the ability kind is passive (can't UseAbility on it)", () => {
    // makePassive helper builds an ability with kind: 'passive'.
    // UseAbility should refuse it.
    const passive = {
      id: abilityId('move_plus_1'),
      name: 'Move +1',
      kind: 'passive' as const,
      bucket: bucketId('movement'),
      baseCost: 1,
      hooks: [],
    };
    const cat = makeAbilitiesCatalog({ abilities: [passive] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, useAbility('u1', 'move_plus_1'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/passive/i);
  });

  it('rejects when MP is insufficient', () => {
    const fireball = makeActive({
      id: 'fireball',
      mpCost: 10,
      targeting: { kind: 'self' },
    });
    const cat = makeAbilitiesCatalog({ abilities: [fireball] });
    const u = makeUnit({ id: 'u1', spd: 10, mp: 5, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(state, useAbility('u1', 'fireball'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/insufficient mp/i);
  });

  it('rejects when actsAvailable is 0', () => {
    const selfBuff = makeActive({ id: 'self_buff', targeting: { kind: 'self' } });
    const cat = makeAbilitiesCatalog({ abilities: [selfBuff] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const turn = activeTurnFor(u.id);
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: { ...turn, budget: { movesAvailable: 1, actsAvailable: 0 } },
    });
    const result = validateAction(state, useAbility('u1', 'self_buff'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/act budget/i);
  });

  it('rejects a single-unit ability when target is out of range', () => {
    const punch = makeActive({
      id: 'punch',
      targeting: {
        kind: 'single_unit',
        range: { horizontal: 1, vertical: 3 },
        rangeMode: 'melee',
      },
    });
    const cat = makeAbilitiesCatalog({ abilities: [punch] });
    const u1 = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const u2 = makeUnit({
      id: 'u2',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 4, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [u1, u2],
      map: flatMap(5, 5),
      turnState: activeTurnFor(u1.id),
    });
    const result = validateAction(state, useAbility('u1', 'punch', 'u2'), cat);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/out of range/i);
  });

  it('accepts a single-unit ability when target is within melee range', () => {
    const punch = makeActive({
      id: 'punch',
      targeting: {
        kind: 'single_unit',
        range: { horizontal: 1, vertical: 3 },
        rangeMode: 'melee',
      },
    });
    const cat = makeAbilitiesCatalog({ abilities: [punch] });
    const u1 = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 0, y: 0, layer: 0 },
    });
    const u2 = makeUnit({
      id: 'u2',
      spd: 10,
      loadout: knightLoadout(),
      position: { x: 1, y: 0, layer: 0 },
    });
    const state = makeGameState({
      units: [u1, u2],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u1.id),
    });
    const result = validateAction(state, useAbility('u1', 'punch', 'u2'), cat);
    expect(result.valid).toBe(true);
  });
});

describe('validateAction — Wait', () => {
  it('accepts Wait during an active turn', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({
      units: [u],
      map: flatMap(3, 3),
      turnState: activeTurnFor(u.id),
    });
    const result = validateAction(
      state,
      { type: 'wait', source: 'player', actorId: u.id, payload: {} },
      cat,
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateAction — system actions', () => {
  it('treats system actions as always-valid (engine emits them)', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u], map: flatMap(3, 3) });
    expect(
      validateAction(
        state,
        { type: 'turn_start', source: 'system', payload: { unitId: u.id } },
        cat,
      ).valid,
    ).toBe(true);
    expect(
      validateAction(
        state,
        { type: 'turn_end', source: 'system', payload: { unitId: u.id } },
        cat,
      ).valid,
    ).toBe(true);
  });
});

// Keep imports tidy.
void bucketId;
