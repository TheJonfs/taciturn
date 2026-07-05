import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
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
import { buildTrainingGroups } from './training-view-model.ts';

const catalog = loadDefaultCatalog();
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

describe('buildTrainingGroups — monk', () => {
  const u = unit({ earnedByClass: { monk: 250 }, unlocks: [tok('bears_heave')] });
  const g = buildTrainingGroups(u, classId('monk'), catalog, CAT);

  it('groups actives and passives, no items/math for a physical class', () => {
    expect(g.items).toHaveLength(0);
    expect(g.math).toHaveLength(0);
    expect(g.actives.length).toBeGreaterThan(0);
    expect(g.passives.map((r) => r.name).sort()).toContain('Barehanded');
    // Barehanded is a Support passive.
    expect(g.passives.find((r) => r.name === 'Barehanded')?.type).toBe('S');
  });

  it('marks a learned component and computes purse/affordability', () => {
    // purse = 250 − 100 (bears_heave) = 150.
    expect(g.purse).toBe(150);
    const bears = g.actives.find((r) => r.name === "Bear's Heave")!;
    expect(bears.learned).toBe(true);
    // chakra costs 300 > 150 → unaffordable, short 150.
    const chakra = g.actives.find((r) => r.name === 'Chakra')!;
    expect(chakra).toMatchObject({ learned: false, affordable: false, shortBy: 150 });
    // serpents_coil costs 150 ≤ 150 → affordable.
    const serpent = g.actives.find((r) => r.name === "Serpent's Coil")!;
    expect(serpent).toMatchObject({ learned: false, affordable: true, shortBy: 0 });
  });

  it('counts affordable-not-yet-learned components', () => {
    const affordable = [...g.actives, ...g.passives].filter((r) => !r.learned && r.affordable);
    expect(g.affordableCount).toBe(affordable.length);
  });
});

describe('buildTrainingGroups — alchemist items', () => {
  it('puts craftable items in the Items group', () => {
    const g = buildTrainingGroups(unit(), classId('alchemist'), catalog, CAT);
    expect(g.items.map((r) => r.name).sort()).toEqual(['Ether', 'Phoenix Down', 'Potion', 'Remedy']);
    expect(g.items.every((r) => r.type === 'I')).toBe(true);
  });
});

describe('buildTrainingGroups — calculator combinator', () => {
  const g = buildTrainingGroups(unit(), classId('calculator'), catalog, CAT);

  it('splits math parameters/values from actives', () => {
    expect(g.math.map((r) => r.type).sort()).toEqual(['PA', 'PA', 'PA', 'PA', 'VA', 'VA', 'VA', 'VA']);
    expect(g.math.map((r) => r.name)).toContain('Current CT');
    expect(g.actives.some((r) => r.name === 'Precision Fire')).toBe(true);
  });

  it('flags the Mathematician enabler with its command-set condition', () => {
    const mathematician = g.passives.find((r) => r.name === 'Mathematician')!;
    expect(mathematician.condition).toBe('Math Skill');
  });
});
