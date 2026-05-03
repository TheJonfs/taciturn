import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { abilityId, commandSetId } from '../types/index.ts';
import { BUCKET_MOVEMENT, BUCKET_REACTION } from './constants.ts';
import { getCommandSetCost, getCost } from './cost.ts';
import {
  makeAbilitiesCatalog,
  makeCommandSet,
  makeKnight,
  makePassive,
} from './test-fixtures.ts';

describe('getCost', () => {
  it('returns the ability baseCost when no modulations apply', () => {
    const move = makePassive({
      id: 'move_plus_1',
      bucket: BUCKET_MOVEMENT,
      baseCost: 1,
    });
    const cat = makeAbilitiesCatalog({ abilities: [move] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(getCost(state, u.id, abilityId('move_plus_1'), cat)).toBe(1);
  });

  it('returns 0 when the unit’s class lists the ability as free', () => {
    const move = makePassive({
      id: 'move_plus_1',
      bucket: BUCKET_MOVEMENT,
      baseCost: 1,
    });
    const cat = makeAbilitiesCatalog({
      abilities: [move],
      classes: [makeKnight({ freeAbilities: ['move_plus_1'] })],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(getCost(state, u.id, abilityId('move_plus_1'), cat)).toBe(0);
  });

  it('does not affect non-listed abilities', () => {
    const a = makePassive({ id: 'free_one', bucket: BUCKET_REACTION, baseCost: 2 });
    const b = makePassive({ id: 'paid_one', bucket: BUCKET_REACTION, baseCost: 3 });
    const cat = makeAbilitiesCatalog({
      abilities: [a, b],
      classes: [makeKnight({ freeAbilities: ['free_one'] })],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(getCost(state, u.id, abilityId('free_one'), cat)).toBe(0);
    expect(getCost(state, u.id, abilityId('paid_one'), cat)).toBe(3);
  });
});

describe('getCommandSetCost', () => {
  it('returns the command set baseCost', () => {
    const set = makeCommandSet({ id: 'battle_skill', baseCost: 1 });
    const cat = makeAbilitiesCatalog({ commandSets: [set] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(getCommandSetCost(state, u.id, commandSetId('battle_skill'), cat)).toBe(1);
  });

  it('honors a non-default baseCost', () => {
    const premium = makeCommandSet({ id: 'premium_skill', baseCost: 2 });
    const cat = makeAbilitiesCatalog({
      commandSets: [
        makeCommandSet({ id: 'battle_skill' }),
        premium,
      ],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(getCommandSetCost(state, u.id, commandSetId('premium_skill'), cat)).toBe(2);
  });
});
