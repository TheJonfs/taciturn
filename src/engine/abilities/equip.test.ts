import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { abilityId, commandSetId } from '../types/index.ts';
import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
} from './constants.ts';
import {
  equipPassive,
  setActiveBucket,
  unequipPassive,
} from './equip.ts';
import {
  knightLoadout,
  loadoutOf,
  makeAbilitiesCatalog,
  makeCommandSet,
  makePassive,
} from './test-fixtures.ts';
import { BUCKET_SECONDARY_COMMAND_SETS } from './constants.ts';

describe('equipPassive', () => {
  it('appends a passive to the bucket and returns the new state when valid', () => {
    const move = makePassive({ id: 'move_plus_1', bucket: BUCKET_MOVEMENT, baseCost: 1 });
    const cat = makeAbilitiesCatalog({ abilities: [move] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const result = equipPassive(state, u.id, BUCKET_MOVEMENT, abilityId('move_plus_1'), cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const newUnit = result.state.units.get(u.id)!;
    expect(newUnit.loadout.passiveBuckets[BUCKET_MOVEMENT]).toEqual([abilityId('move_plus_1')]);
  });

  it('does not mutate the input state', () => {
    const move = makePassive({ id: 'move_plus_1', bucket: BUCKET_MOVEMENT, baseCost: 1 });
    const cat = makeAbilitiesCatalog({ abilities: [move] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    equipPassive(state, u.id, BUCKET_MOVEMENT, abilityId('move_plus_1'), cat);
    expect(state.units.get(u.id)!.loadout.passiveBuckets[BUCKET_MOVEMENT] ?? []).toEqual([]);
  });

  it('refuses an equip that would exceed capacity', () => {
    const heavy = makePassive({ id: 'heavy', bucket: BUCKET_MOVEMENT, baseCost: 3 });
    const cat = makeAbilitiesCatalog({ abilities: [heavy] });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout({
        passive: [[BUCKET_MOVEMENT, [abilityId('heavy')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    const result = equipPassive(state, u.id, BUCKET_MOVEMENT, abilityId('heavy'), cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.validation.ok).toBe(false);
  });

  it('refuses an equip into the wrong bucket', () => {
    const reactionAbility = makePassive({ id: 'r', bucket: BUCKET_REACTION });
    const cat = makeAbilitiesCatalog({ abilities: [reactionAbility] });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const result = equipPassive(state, u.id, BUCKET_MOVEMENT, abilityId('r'), cat);
    expect(result.ok).toBe(false);
  });
});

describe('unequipPassive', () => {
  it('removes the indexed entry and returns the new state', () => {
    const a = makePassive({ id: 'a', bucket: BUCKET_MOVEMENT });
    const b = makePassive({ id: 'b', bucket: BUCKET_MOVEMENT });
    const cat = makeAbilitiesCatalog({ abilities: [a, b] });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout({
        passive: [[BUCKET_MOVEMENT, [abilityId('a'), abilityId('b')]]],
      }),
    });
    const state = makeGameState({ units: [u] });
    const result = unequipPassive(state, u.id, BUCKET_MOVEMENT, 0, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.units.get(u.id)!.loadout.passiveBuckets[BUCKET_MOVEMENT]).toEqual([
      abilityId('b'),
    ]);
  });

  it('throws on an out-of-range index', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    expect(() => unequipPassive(state, u.id, BUCKET_MOVEMENT, 0, cat)).toThrow(/out of range/);
  });
});

describe('setActiveBucket', () => {
  it('sets a known command set in the bucket', () => {
    const cat = makeAbilitiesCatalog({
      commandSets: [
        makeCommandSet({ id: 'battle_skill' }),
        makeCommandSet({ id: 'second_skill' }),
      ],
    });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const result = setActiveBucket(
      state,
      u.id,
      BUCKET_SECONDARY_COMMAND_SETS,
      commandSetId('second_skill'),
      cat,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.units.get(u.id)!.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS]).toEqual([
      commandSetId('second_skill'),
    ]);
  });

  it('clears the secondary_command_sets bucket with null', () => {
    const cat = makeAbilitiesCatalog({
      commandSets: [
        makeCommandSet({ id: 'battle_skill' }),
        makeCommandSet({ id: 'second_skill' }),
      ],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: knightLoadout({
        active: [[BUCKET_SECONDARY_COMMAND_SETS, commandSetId('second_skill')]],
      }),
    });
    const state = makeGameState({ units: [u] });
    const result = setActiveBucket(state, u.id, BUCKET_SECONDARY_COMMAND_SETS, null, cat);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.units.get(u.id)!.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS]).toEqual([]);
  });

  it('refuses clearing first_action (would violate the class pin)', () => {
    const cat = makeAbilitiesCatalog({
      commandSets: [makeCommandSet({ id: 'battle_skill' })],
    });
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const result = setActiveBucket(state, u.id, BUCKET_FIRST_ACTION, null, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.validation.ok === false &&
        result.validation.violations.some((v) => v.kind === 'first_action_pin_violated'),
    ).toBe(true);
  });

  it('refuses an unknown command set', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10, loadout: knightLoadout() });
    const state = makeGameState({ units: [u] });
    const result = setActiveBucket(
      state,
      u.id,
      BUCKET_SECONDARY_COMMAND_SETS,
      commandSetId('not_real'),
      cat,
    );
    expect(result.ok).toBe(false);
  });
});

// Unused — keep imports tidy.
void loadoutOf;
