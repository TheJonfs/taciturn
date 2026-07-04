import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
  type ClassId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_JP_LEDGER } from '../types.ts';
import { buildComponentCatalog, type ComponentMeta } from './component-catalog.ts';
import { availableJp, reclassableClasses, spentByTierSlot, unlockedTiers } from './ledger.ts';
import type { UnlockToken } from './tokens.ts';

// A priced ability component owned by `nativeClass` (which fixes its slot).
function comp(id: string, cost: number, nativeClass: string): ComponentMeta {
  return { token: { kind: 'ability', id: abilityId(id) }, cost, nativeClass: classId(nativeClass) };
}
function tok(id: string): UnlockToken {
  return { kind: 'ability', id: abilityId(id) };
}

// Fixture catalog: one component per slot we want to drive spend into.
const CAT = buildComponentCatalog([
  comp('pT1a', 500, 'monk'), // physical:1
  comp('pT1b', 500, 'monk'), // physical:1
  comp('pT2a', 500, 'knight'), // physical:2
  comp('mT1a', 500, 'fire_mage'), // magical:1
  comp('mT2a', 500, 'lightning_mage'), // magical:2
  comp('hT2a', 1000, 'templar'), // hybrid:2
]);

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
    jpLedger: EMPTY_JP_LEDGER,
    unlocks: [],
    fate: 'active',
    ...over,
  };
}

function set(ids: ReadonlyArray<ClassId>): ReadonlySet<string> {
  return new Set(ids.map((id) => String(id)));
}

describe('availableJp', () => {
  it('is earned minus spent', () => {
    expect(availableJp({ earned: 300, spent: 100 })).toBe(200);
    expect(availableJp(EMPTY_JP_LEDGER)).toBe(0);
  });
});

describe('spentByTierSlot', () => {
  it('buckets each unlock cost by its native class slot', () => {
    const u = unit({ unlocks: [tok('pT1a'), tok('pT1b'), tok('mT1a')] });
    const spent = spentByTierSlot(u, CAT);
    expect(spent.get('physical:1')).toBe(1000);
    expect(spent.get('magical:1')).toBe(500);
    expect(spent.get('physical:2')).toBeUndefined();
  });

  it('throws loudly on a token the catalog does not price', () => {
    const u = unit({ unlocks: [tok('unknown')] });
    expect(() => spentByTierSlot(u, CAT)).toThrow(/no catalog entry/);
  });
});

describe('unlockedTiers — seeding from the current class', () => {
  it('a fresh Tier-1 unit has only its own half Tier 1 open', () => {
    const open = unlockedTiers(unit({ classId: classId('monk') }), CAT);
    expect([...open]).toEqual(['physical:1']);
  });

  it('a unit currently in a Tier-2 class has climbed-through tiers open (reclass down)', () => {
    const open = unlockedTiers(unit({ classId: classId('knight') }), CAT);
    expect(open.has('physical:1')).toBe(true);
    expect(open.has('physical:2')).toBe(true);
    expect(open.has('magical:1')).toBe(false);
  });
});

describe('unlockedTiers — thresholds', () => {
  it('500 in a half T1 opens that half T2 AND the other half T1', () => {
    const open = unlockedTiers(unit({ unlocks: [tok('pT1a')] }), CAT); // 500 physical:1
    expect(open.has('physical:2')).toBe(true);
    expect(open.has('magical:1')).toBe(true);
    expect(open.has('magical:2')).toBe(false);
    expect(open.has('physical:3')).toBe(false);
  });

  it('1000 in a half T1 + 500 in that half T2 opens that half T3', () => {
    const u = unit({ unlocks: [tok('pT1a'), tok('pT1b'), tok('pT2a')] }); // 1000 pT1, 500 pT2
    const open = unlockedTiers(u, CAT);
    expect(open.has('physical:3')).toBe(true);
  });

  it('does not open T3 with only 500 in T1 even if T2 is funded', () => {
    const u = unit({ unlocks: [tok('pT1a'), tok('pT2a')] }); // 500 pT1, 500 pT2
    expect(unlockedTiers(u, CAT).has('physical:3')).toBe(false);
  });

  it('500 in BOTH halves T1 opens Hybrid Tier 2', () => {
    const u = unit({ unlocks: [tok('pT1a'), tok('mT1a')] });
    expect(unlockedTiers(u, CAT).has('hybrid:2')).toBe(true);
  });

  it('1000 in Hybrid T2 opens the Hybrid T3 seam', () => {
    // Reach hybrid:2 (both T1s) then spend 1000 in hybrid:2.
    const u = unit({ unlocks: [tok('pT1a'), tok('mT1a'), tok('hT2a')] });
    const open = unlockedTiers(u, CAT);
    expect(open.has('hybrid:2')).toBe(true);
    expect(open.has('hybrid:3')).toBe(true);
  });
});

describe('reclassableClasses', () => {
  it('a fresh Monk can reclass within physical Tier 1 only', () => {
    const got = set(reclassableClasses(unit({ classId: classId('monk') }), CAT));
    expect(got).toEqual(set([classId('alchemist'), classId('monk'), classId('hunter')]));
  });

  it('after 500 in physical T1, physical T2 + magical T1 classes open up', () => {
    const got = set(reclassableClasses(unit({ unlocks: [tok('pT1a')] }), CAT));
    expect(got.has(String(classId('knight')))).toBe(true); // physical:2
    expect(got.has(String(classId('thief')))).toBe(true);
    expect(got.has(String(classId('fire_mage')))).toBe(true); // magical:1
    expect(got.has(String(classId('calculator')))).toBe(false); // magical:3 still closed
  });

  it('classAccessOverride unions in a class whose tier is NOT open (plot-unique)', () => {
    const u = unit({ classId: classId('monk'), classAccessOverride: [classId('calculator')] });
    const got = set(reclassableClasses(u, CAT));
    expect(got.has(String(classId('calculator')))).toBe(true);
    // ...without opening magical:3 for anyone else.
    expect(unlockedTiers(u, CAT).has('magical:3')).toBe(false);
  });
});
