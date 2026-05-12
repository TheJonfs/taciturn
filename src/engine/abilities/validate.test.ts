import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { abilityId, bucketId, commandSetId } from '../types/index.ts';
import {
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_FIRST_ACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
} from './constants.ts';
import {
  knightLoadout,
  makeAbilitiesCatalog,
  makeActive,
  makeCommandSet,
  makeKnight,
  makePassive,
} from './test-fixtures.ts';
import { validateLoadout } from './validate.ts';

describe('validateLoadout — happy paths', () => {
  it('accepts the minimum pin-satisfying loadout', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    expect(validateLoadout(state, u.id, knightLoadout(), cat).ok).toBe(true);
  });

  it('accepts a loadout that fits exactly within passive capacity', () => {
    const a = makePassive({ id: 'a', bucket: BUCKET_MOVEMENT, baseCost: 1 });
    const b = makePassive({ id: 'b', bucket: BUCKET_MOVEMENT, baseCost: 2 });
    const cat = makeAbilitiesCatalog({ abilities: [a, b] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [[BUCKET_MOVEMENT, [abilityId('a'), abilityId('b')]]],
    });
    expect(validateLoadout(state, u.id, loadout, cat).ok).toBe(true);
  });

  it('class-free abilities reduce used capacity to 0', () => {
    const heavy = makePassive({ id: 'heavy', bucket: BUCKET_MOVEMENT, baseCost: 3 });
    const cat = makeAbilitiesCatalog({
      abilities: [heavy],
      classes: [makeKnight({ freeAbilities: ['heavy'] })],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [
        // Three "heavy" instances would normally cost 9 (over capacity 3).
        // With the class grant they're cost 0 each — fits.
        [BUCKET_MOVEMENT, [abilityId('heavy'), abilityId('heavy'), abilityId('heavy')]],
      ],
    });
    expect(validateLoadout(state, u.id, loadout, cat).ok).toBe(true);
  });

  it('accepts an active bucket holding a known command set', () => {
    const cat = makeAbilitiesCatalog({
      commandSets: [makeCommandSet({ id: 'battle_skill' })],
    });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      active: [[BUCKET_FIRST_ACTION, commandSetId('battle_skill')]],
    });
    expect(validateLoadout(state, u.id, loadout, cat).ok).toBe(true);
  });
});

describe('validateLoadout — violations', () => {
  it('reports over_capacity when the sum exceeds the bucket cap', () => {
    const a = makePassive({ id: 'a', bucket: BUCKET_MOVEMENT, baseCost: 3 });
    const b = makePassive({ id: 'b', bucket: BUCKET_MOVEMENT, baseCost: 2 });
    const cat = makeAbilitiesCatalog({ abilities: [a, b] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [[BUCKET_MOVEMENT, [abilityId('a'), abilityId('b')]]],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toEqual([
      { kind: 'over_capacity', bucketId: BUCKET_MOVEMENT, capacity: 3, used: 5 },
    ]);
  });

  it('reports unknown_ability when an equipped id is not in the catalog', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [[BUCKET_REACTION, [abilityId('does_not_exist')]]],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContainEqual({
      kind: 'unknown_ability',
      bucketId: BUCKET_REACTION,
      abilityId: abilityId('does_not_exist'),
    });
  });

  it('reports wrong_bucket when a passive is equipped in a non-matching bucket', () => {
    const supportThing = makePassive({ id: 'support_thing', bucket: BUCKET_SUPPORT });
    const cat = makeAbilitiesCatalog({ abilities: [supportThing] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [[BUCKET_MOVEMENT, [abilityId('support_thing')]]],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContainEqual({
      kind: 'wrong_bucket',
      bucketId: BUCKET_MOVEMENT,
      abilityId: abilityId('support_thing'),
      abilityHomeBucket: BUCKET_SUPPORT,
    });
  });

  it('reports wrong_kind_for_bucket when an active ability is in a passive bucket', () => {
    const attack = makeActive({ id: 'attack' });
    const cat = makeAbilitiesCatalog({ abilities: [attack] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      passive: [[BUCKET_MOVEMENT, [abilityId('attack')]]],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContainEqual({
      kind: 'wrong_kind_for_bucket',
      bucketId: BUCKET_MOVEMENT,
      abilityId: abilityId('attack'),
      expected: 'passive',
      actual: 'active',
    });
  });

  it('reports unknown_command_set when an active bucket points at a missing CommandSet', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      active: [[BUCKET_SECONDARY_COMMAND_SETS, commandSetId('not_in_catalog')]],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContainEqual({
      kind: 'unknown_command_set',
      bucketId: BUCKET_SECONDARY_COMMAND_SETS,
      commandSetId: commandSetId('not_in_catalog'),
    });
  });

  it('reports unknown_bucket when a loadout key is not a known bucket', () => {
    const cat = makeAbilitiesCatalog({});
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = {
      actionBuckets: {},
      passiveBuckets: { [bucketId('typo_bucket')]: [] },
    };
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContainEqual({
      kind: 'unknown_bucket',
      bucketId: bucketId('typo_bucket'),
    });
  });

  it('enumerates *all* violations rather than first-error', () => {
    const aBad = makePassive({ id: 'a', bucket: BUCKET_REACTION, baseCost: 2 });
    const cat = makeAbilitiesCatalog({ abilities: [aBad] });
    const u = makeUnit({ id: 'u1', spd: 10 });
    const state = makeGameState({ units: [u] });
    const loadout = knightLoadout({
      // Movement bucket: unknown ability AND would be over capacity if it weren't.
      passive: [
        [BUCKET_MOVEMENT, [abilityId('does_not_exist')]],
        // Reaction: legit but over capacity from too many copies (3 × 2 = 6 > 3).
        [
          BUCKET_REACTION,
          [abilityId('a'), abilityId('a'), abilityId('a')],
        ],
      ],
    });
    const result = validateLoadout(state, u.id, loadout, cat);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // unknown_ability for movement; over_capacity for reaction.
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
    expect(result.violations.some((v) => v.kind === 'unknown_ability')).toBe(true);
    expect(result.violations.some((v) => v.kind === 'over_capacity')).toBe(true);
  });
});
