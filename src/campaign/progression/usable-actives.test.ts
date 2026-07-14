import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  itemId,
  unitId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_EARNED_BY_CLASS } from '../types.ts';
import {
  usableActiveIds,
  usableItemIds,
  usableMathParameterIds,
  usableMathValueIds,
} from './usable-actives.ts';
import type { UnlockToken } from './tokens.ts';

const catalog = loadDefaultCatalog();

function unit(over: Partial<CampaignUnit> = {}): CampaignUnit {
  return {
    id: unitId('u1'),
    name: 'Test',
    classId: classId('monk'),
    level: 25,
    brave: 70,
    faith: 70,
    loadout: EMPTY_LOADOUT,
    equipment: EMPTY_UNIT_EQUIPMENT,
    vitals: { hp: 100, mp: 20 },
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
    ...over,
  };
}

describe('usableActiveIds', () => {
  it('a fresh unit can use its class free abilities but no command-set actives', () => {
    const ids = new Set(usableActiveIds(unit(), catalog).map(String));
    expect(ids.has(String(abilityId('attack')))).toBe(true); // free (Monk)
    expect(ids.has(String(abilityId('chakra')))).toBe(false); // Martial Arts — must be unlocked
  });

  it('unlocking an ability adds it to the usable set (union with free abilities)', () => {
    const chakra: UnlockToken = { kind: 'ability', id: abilityId('chakra') };
    const ids = new Set(usableActiveIds(unit({ unlocks: [chakra] }), catalog).map(String));
    expect(ids.has(String(abilityId('chakra')))).toBe(true);
    expect(ids.has(String(abilityId('attack')))).toBe(true); // free abilities still present
  });

  it('ignores non-ability unlock tokens (items / math components)', () => {
    const unlocks: ReadonlyArray<UnlockToken> = [
      { kind: 'item', id: itemId('potion') },
      { kind: 'mathParameter', id: 'level' },
      { kind: 'mathValue', id: 3 },
    ];
    const before = new Set(usableActiveIds(unit(), catalog).map(String));
    const after = new Set(usableActiveIds(unit({ unlocks }), catalog).map(String));
    expect(after).toEqual(before); // no change — none are abilities
  });
});

describe('combinator-component projections', () => {
  const unlocks: ReadonlyArray<UnlockToken> = [
    { kind: 'ability', id: abilityId('precision_fire') }, // ignored by all three
    { kind: 'item', id: itemId('potion') },
    { kind: 'item', id: itemId('ether') },
    { kind: 'mathParameter', id: 'level' },
    { kind: 'mathValue', id: 3 },
    { kind: 'mathValue', id: 'prime' },
  ];
  const u = unit({ unlocks });

  it('usableItemIds returns only unlocked item tokens (no free/innate items)', () => {
    expect(new Set(usableItemIds(u).map(String))).toEqual(new Set(['potion', 'ether']));
    expect(usableItemIds(unit())).toEqual([]); // empty combinator until unlocked
  });

  it('usableMathParameterIds / usableMathValueIds return only their kind', () => {
    expect(usableMathParameterIds(u)).toEqual(['level']);
    expect(new Set(usableMathValueIds(u))).toEqual(new Set([3, 'prime']));
    expect(usableMathParameterIds(unit())).toEqual([]);
    expect(usableMathValueIds(unit())).toEqual([]);
  });
});

describe('the delivery-action rule (S94): wielded command sets contribute non-component members', () => {
  const FIRST_ACTION = bucketId('first_action');
  const SECONDARY = bucketId('secondary_command_sets');

  it('an Alchemist with only a potion unlock can Compound and Throw Item', () => {
    const alchemist = unit({
      classId: classId('alchemist'),
      loadout: {
        actionBuckets: { [FIRST_ACTION]: [commandSetId('alchemy')] },
        passiveBuckets: {},
      },
      unlocks: [{ kind: 'item', id: itemId('potion') }],
    });
    const usable = new Set(usableActiveIds(alchemist, catalog).map(String));
    expect(usable.has('compound')).toBe(true);
    expect(usable.has('throw_item')).toBe(true);
  });

  it('a Knight wielding Alchemy as a SECONDARY gets the delivery actions too', () => {
    const knight = unit({
      classId: classId('knight'),
      loadout: {
        actionBuckets: {
          [FIRST_ACTION]: [commandSetId('battle_skill')],
          [SECONDARY]: [commandSetId('alchemy')],
        },
        passiveBuckets: {},
      },
      unlocks: [{ kind: 'item', id: itemId('potion') }],
    });
    const usable = new Set(usableActiveIds(knight, catalog).map(String));
    expect(usable.has('compound')).toBe(true);
    expect(usable.has('throw_item')).toBe(true);
  });

  it('component members of a wielded set stay LOCKED until bought (Scorch)', () => {
    const mage = unit({
      classId: classId('fire_mage'),
      loadout: {
        actionBuckets: { [FIRST_ACTION]: [commandSetId('fire_spells')] },
        passiveBuckets: {},
      },
      unlocks: [],
    });
    const usable = new Set(usableActiveIds(mage, catalog).map(String));
    expect(usable.has('fire_strike')).toBe(false); // a JP component — still gated
  });
});
