import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_EARNED_BY_CLASS } from '../types.ts';
import {
  buildComponentCatalog,
  isComponentAvailableTo,
  type ComponentMeta,
} from './component-catalog.ts';
import {
  canEquipPassive,
  grantJp,
  grantOnClassUnlock,
  GRANT_BASE_PER_TIER,
  GRANT_RANDOM_RANGE,
  tierGrantAmount,
  unlockComponent,
} from './unlock.ts';
import { availableInClass } from './ledger.ts';
import { tokenKey, type UnlockToken } from './tokens.ts';

function comp(id: string, cost: number, nativeClass: string): ComponentMeta {
  return { token: { kind: 'ability', id: abilityId(id) }, cost, nativeClass: classId(nativeClass) };
}
function tok(id: string): UnlockToken {
  return { kind: 'ability', id: abilityId(id) };
}

const CAT = buildComponentCatalog([
  comp('buyme', 150, 'monk'),
  comp('pricey', 300, 'monk'),
  comp('export_ok', 200, 'monk'),
  comp('enabler', 200, 'terraformer'), // an "inert-without-its-set" passive
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
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: [],
    fate: 'active',
    ...over,
  };
}

describe('unlockComponent', () => {
  it('appends the token; spend is derived from the unlock (no stored spent)', () => {
    const u = unit({ earnedByClass: { monk: 300 } });
    const after = unlockComponent(u, tok('buyme'), CAT); // 150, native monk
    expect(after.unlocks.map(tokenKey)).toEqual(['ability:buyme']);
    expect(availableInClass(after, classId('monk'), CAT)).toBe(150); // 300 − 150
  });

  it('does not mutate the input unit (immutable)', () => {
    const u = unit({ earnedByClass: { monk: 300 } });
    unlockComponent(u, tok('buyme'), CAT);
    expect(u.unlocks).toEqual([]);
    expect(availableInClass(u, classId('monk'), CAT)).toBe(300);
  });

  it('throws when the component is already unlocked', () => {
    const u = unit({ earnedByClass: { monk: 300 }, unlocks: [tok('buyme')] });
    expect(() => unlockComponent(u, tok('buyme'), CAT)).toThrow(/already unlocked/);
  });

  it('throws when the unit cannot afford it in the native class', () => {
    const u = unit({ earnedByClass: { monk: 200 } }); // 200 monk JP available
    expect(() => unlockComponent(u, tok('pricey'), CAT)).toThrow(/costs 300 monk JP but only 200/);
  });

  it('affordability is per-class — JP earned in another class does NOT count', () => {
    // 500 fire_mage JP, 0 monk JP; buyme is a monk component.
    const u = unit({ earnedByClass: { fire_mage: 500 } });
    expect(() => unlockComponent(u, tok('buyme'), CAT)).toThrow(/only 0 available/);
  });
});

// TABA Seam 3 — unit-restricted components.
describe('unlockComponent — unit-restricted (Seam 3)', () => {
  const RESTRICTED: ComponentMeta = {
    token: { kind: 'ability', id: abilityId('signature') },
    cost: 200,
    nativeClass: classId('monk'),
    restrictedToUnit: unitId('u1'),
  };
  const RCAT = buildComponentCatalog([RESTRICTED]);

  it('isComponentAvailableTo: offered only to the restricted unit', () => {
    expect(isComponentAvailableTo(RESTRICTED, unitId('u1'))).toBe(true);
    expect(isComponentAvailableTo(RESTRICTED, unitId('u2'))).toBe(false);
    // An unrestricted component is offered to anyone.
    expect(isComponentAvailableTo(comp('buyme', 150, 'monk'), unitId('u2'))).toBe(true);
  });

  it('the restricted unit can buy its own component', () => {
    const u = unit({ id: unitId('u1'), earnedByClass: { monk: 300 } });
    const after = unlockComponent(u, tok('signature'), RCAT);
    expect(after.unlocks.map(tokenKey)).toContain(tokenKey(tok('signature')));
  });

  it('another unit cannot buy it even with the JP (authoritative gate)', () => {
    const other = unit({ id: unitId('u2'), earnedByClass: { monk: 300 } });
    expect(() => unlockComponent(other, tok('signature'), RCAT)).toThrow(/restricted to unit/);
  });
});

describe('grants', () => {
  it('grantJp adds into a class pool and rejects negatives', () => {
    expect(grantJp(unit(), classId('monk'), 120).earnedByClass).toEqual({ monk: 120 });
    expect(() => grantJp(unit(), classId('monk'), -1)).toThrow(/non-negative/);
  });

  it('tierGrantAmount is base(tier×100) + a bounded deterministic bonus', () => {
    for (const tier of [1, 2, 3] as const) {
      const amount = tierGrantAmount(tier, 12345);
      const base = GRANT_BASE_PER_TIER * tier;
      expect(amount).toBeGreaterThanOrEqual(base);
      expect(amount).toBeLessThan(base + GRANT_RANDOM_RANGE);
    }
  });

  it('is deterministic in (tier, seed) and lands in the unlocked class pool', () => {
    expect(tierGrantAmount(3, 999)).toBe(tierGrantAmount(3, 999));
    const after = grantOnClassUnlock(unit(), classId('knight'), 2, 7);
    expect(after.earnedByClass['knight']).toBe(tierGrantAmount(2, 7));
  });

  it('different seeds generally yield different bonuses', () => {
    const a = tierGrantAmount(2, 1);
    const b = tierGrantAmount(2, 2);
    const c = tierGrantAmount(2, 3);
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });
});

describe('canEquipPassive — R/S/M export gating', () => {
  it('is free in the native class regardless of unlock state', () => {
    const u = unit({ classId: classId('monk') }); // native = monk
    expect(canEquipPassive(u, abilityId('export_ok'), classId('monk'), CAT).ok).toBe(true);
  });

  it('on a non-native class, requires the export tax (unlock) to be paid', () => {
    const locked = unit({ classId: classId('knight') });
    const gate = canEquipPassive(locked, abilityId('export_ok'), classId('knight'), CAT);
    expect(gate.ok).toBe(false);

    const paid = unit({ classId: classId('knight'), unlocks: [tok('export_ok')] });
    expect(canEquipPassive(paid, abilityId('export_ok'), classId('knight'), CAT).ok).toBe(true);
  });

  it('an enabler passive is exportable like any other — no hard class-lock', () => {
    // "Inert without its Command Set" is a runtime property, NOT an equip block:
    // buyable + equippable off-class once unlocked (it just does nothing without
    // the set). Free in its own native class regardless.
    const native = unit({ classId: classId('terraformer') });
    expect(canEquipPassive(native, abilityId('enabler'), classId('terraformer'), CAT).ok).toBe(true);

    const foreignLocked = unit({ classId: classId('knight') });
    expect(canEquipPassive(foreignLocked, abilityId('enabler'), classId('knight'), CAT).ok).toBe(
      false, // export tax unpaid
    );

    const foreignPaid = unit({ classId: classId('knight'), unlocks: [tok('enabler')] });
    expect(canEquipPassive(foreignPaid, abilityId('enabler'), classId('knight'), CAT).ok).toBe(true);
  });
});
