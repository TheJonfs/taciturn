import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import { EMPTY_EARNED_BY_CLASS, type CampaignUnit } from '../types.ts';
import { COMPONENT_CATALOG } from './component-catalog-data.ts';
import { purchaseComponent } from './purchase.ts';
import type { UnlockToken } from './tokens.ts';

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

describe('purchaseComponent', () => {
  it('adds the unlock and spends from the class purse', () => {
    const { unit: out, ignited } = purchaseComponent(
      unit({ earnedByClass: { monk: 300 }, unlocks: [] }),
      tok('bears_heave'),
      CAT,
    );
    expect(out.unlocks.map((t) => String(t.id))).toContain('bears_heave');
    expect(ignited).toEqual([]); // 100 spend opens nothing new
  });

  it('ignites and grants every newly-reclassable class when a threshold is crossed', () => {
    // Monk at 300 spent in physical:1; buying Chakra (300) → 600 ≥ 500 opens
    // physical:2 (Knight, Thief) AND magical:1 (the three mages, other-half rule).
    const base = unit({ earnedByClass: { monk: 800 }, unlocks: [tok('serpents_coil'), tok('foxfire')] });
    const { unit: out, ignited } = purchaseComponent(base, tok('chakra'), CAT);

    const opened = new Set(ignited.map(String));
    expect(opened).toEqual(
      new Set(['knight', 'thief', 'fire_mage', 'water_mage', 'earth_mage']),
    );
    // Each newly-opened class received a tier-scaled head-start grant.
    expect(out.earnedByClass['knight']).toBeGreaterThanOrEqual(200); // T2 grant
    expect(out.earnedByClass['fire_mage']).toBeGreaterThanOrEqual(100); // T1 grant
    // The current class (monk) is not "newly opened" — no grant, still 800 earned.
    expect(out.earnedByClass['monk']).toBe(800);
  });

  it('is deterministic — same input yields the same grants', () => {
    const base = unit({ earnedByClass: { monk: 800 }, unlocks: [tok('serpents_coil'), tok('foxfire')] });
    const a = purchaseComponent(base, tok('chakra'), CAT);
    const b = purchaseComponent(base, tok('chakra'), CAT);
    expect(a.unit.earnedByClass).toEqual(b.unit.earnedByClass);
  });

  it('throws (does not swallow) on an unaffordable buy', () => {
    expect(() => purchaseComponent(unit({ earnedByClass: { monk: 50 } }), tok('bears_heave'), CAT)).toThrow();
  });
});
