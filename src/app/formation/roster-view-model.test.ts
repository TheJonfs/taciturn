import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  EMPTY_EARNED_BY_CLASS,
  type CampaignUnit,
  type UnlockToken,
} from '@campaign/index.ts';
import {
  buildRosterEntries,
  filterAndSortRoster,
  isPlotUnique,
  rosterSummary,
  unitDomain,
  unitIdleJp,
  unitInvestment,
  unitTotalInvested,
} from './roster-view-model.ts';

const CAT = COMPONENT_CATALOG;
const tok = (id: string): UnlockToken => ({ kind: 'ability', id: abilityId(id) });

function unit(over: Partial<CampaignUnit> = {}): CampaignUnit {
  return {
    id: unitId('u'),
    name: 'Test',
    classId: classId('monk'),
    level: 20,
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

describe('unitDomain', () => {
  it('reads the current class half from the tier map', () => {
    expect(unitDomain(unit({ classId: classId('monk') }))).toBe('physical');
    expect(unitDomain(unit({ classId: classId('fire_mage') }))).toBe('magical');
    expect(unitDomain(unit({ classId: classId('templar') }))).toBe('hybrid');
  });
});

describe('unitIdleJp', () => {
  it('sums spendable JP across all classes (earned minus derived spend)', () => {
    // Monk: 400 earned, spent 100 (bears_heave) → 300 idle.
    // Knight: 200 earned, spent 0 → 200 idle. Total 500.
    const u = unit({
      earnedByClass: { monk: 400, knight: 200 },
      unlocks: [tok('bears_heave')],
    });
    expect(unitIdleJp(u, CAT)).toBe(500);
  });

  it('is 0 for a fresh unit', () => {
    expect(unitIdleJp(unit(), CAT)).toBe(0);
  });
});

describe('unitInvestment', () => {
  it('lists only built-up classes, brightest first, sized by derived spend', () => {
    const u = unit({
      earnedByClass: { monk: 500, knight: 300, thief: 100 }, // thief earned but unspent
      unlocks: [tok('bears_heave'), tok('chakra'), tok('power_attack')], // monk 400, knight 100
    });
    const inv = unitInvestment(u, CAT);
    expect(inv.map((d) => d.classId)).toEqual([classId('monk'), classId('knight')]);
    expect(inv[0]).toMatchObject({ spent: 400, domain: 'physical' });
    expect(inv[1]).toMatchObject({ spent: 100, domain: 'physical' });
    // thief has idle JP but no spend → not a trace dot.
    expect(inv.some((d) => d.classId === classId('thief'))).toBe(false);
  });
});

describe('unitTotalInvested', () => {
  it('sums derived spend across every class (the aura brightness)', () => {
    const u = unit({
      earnedByClass: { monk: 500, knight: 300 },
      unlocks: [tok('bears_heave'), tok('chakra'), tok('power_attack')],
    });
    expect(unitTotalInvested(u, CAT)).toBe(500); // 100 + 300 + 100
  });
});

describe('isPlotUnique', () => {
  it('flags units carrying a class-access override', () => {
    expect(isPlotUnique(unit())).toBe(false);
    expect(isPlotUnique(unit({ classAccessOverride: [classId('assassin')] }))).toBe(true);
  });
});

describe('filterAndSortRoster', () => {
  const roster: ReadonlyArray<CampaignUnit> = [
    unit({ id: unitId('a'), name: 'Bran', classId: classId('knight'), level: 25, earnedByClass: { knight: 150 } }),
    unit({ id: unitId('b'), name: 'Aldren', classId: classId('monk'), level: 24, earnedByClass: { monk: 300 }, unlocks: [tok('bears_heave')] }),
    unit({ id: unitId('c'), name: 'Sereth', classId: classId('fire_mage'), level: 23, earnedByClass: { fire_mage: 100 }, unlocks: [tok('fire_strike')] }),
  ];
  const entries = buildRosterEntries(roster, CAT);

  it('filters by has-jp (idle purse > 0 anywhere)', () => {
    // Bran: 150 idle. Aldren: 300-100=200 idle. Sereth: 100-100=0 idle.
    const has = filterAndSortRoster(entries, 'has-jp', 'name');
    expect(has.map((e) => e.unit.name)).toEqual(['Aldren', 'Bran']);
  });

  it('filters by current-class domain', () => {
    expect(filterAndSortRoster(entries, 'magical', 'name').map((e) => e.unit.name)).toEqual(['Sereth']);
    expect(filterAndSortRoster(entries, 'physical', 'name').map((e) => e.unit.name)).toEqual(['Aldren', 'Bran']);
  });

  it('sorts by name, level desc, newest, and unspent JP desc', () => {
    expect(filterAndSortRoster(entries, 'all', 'name').map((e) => e.unit.name)).toEqual(['Aldren', 'Bran', 'Sereth']);
    expect(filterAndSortRoster(entries, 'all', 'level').map((e) => e.unit.name)).toEqual(['Bran', 'Aldren', 'Sereth']);
    expect(filterAndSortRoster(entries, 'all', 'newest').map((e) => e.unit.name)).toEqual(['Sereth', 'Aldren', 'Bran']);
    expect(filterAndSortRoster(entries, 'all', 'unspent-jp').map((e) => e.unit.name)).toEqual(['Aldren', 'Bran', 'Sereth']);
  });
});

describe('rosterSummary', () => {
  it('counts units, those with unspent JP, and total idle JP', () => {
    const roster = [
      unit({ name: 'A', earnedByClass: { monk: 300 }, unlocks: [tok('bears_heave')] }), // 200 idle
      unit({ name: 'B', earnedByClass: { monk: 100 }, unlocks: [tok('bears_heave')] }), // 0 idle
    ];
    const s = rosterSummary(buildRosterEntries(roster, CAT));
    expect(s).toEqual({ total: 2, withUnspent: 1, totalIdleJp: 200 });
  });
});

// S100 (Fix 3): fallen marking — the card's memorial state.
describe('isFallen', () => {
  it('marks fate === "lost" entries and leaves active ones unmarked', () => {
    const entries = buildRosterEntries(
      [unit({ id: unitId('alive') }), unit({ id: unitId('gone'), fate: 'lost' })],
      CAT,
    );
    expect(entries.map((e) => e.isFallen)).toEqual([false, true]);
  });
});
