import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  itemId,
  unitId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_EARNED_BY_CLASS } from '../types.ts';
import { usableActiveIds } from './usable-actives.ts';
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
