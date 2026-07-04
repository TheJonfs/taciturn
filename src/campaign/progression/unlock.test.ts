import { describe, expect, it } from 'vitest';
import {
  abilityId,
  classId,
  EMPTY_LOADOUT,
  EMPTY_UNIT_EQUIPMENT,
  unitId,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { EMPTY_JP_LEDGER } from '../types.ts';
import { buildComponentCatalog, type ComponentMeta } from './component-catalog.ts';
import {
  canEquipPassive,
  grantJp,
  grantOnClassUnlock,
  GRANT_BASE_PER_TIER,
  GRANT_RANDOM_RANGE,
  tierGrantAmount,
  unlockComponent,
} from './unlock.ts';
import { availableJp } from './ledger.ts';
import { tokenKey, type UnlockToken } from './tokens.ts';

function comp(
  id: string,
  cost: number,
  nativeClass: string,
  exportable?: boolean,
): ComponentMeta {
  const token: UnlockToken = { kind: 'ability', id: abilityId(id) };
  return exportable === undefined
    ? { token, cost, nativeClass: classId(nativeClass) }
    : { token, cost, nativeClass: classId(nativeClass), exportable };
}
function tok(id: string): UnlockToken {
  return { kind: 'ability', id: abilityId(id) };
}

const CAT = buildComponentCatalog([
  comp('buyme', 150, 'monk'),
  comp('pricey', 300, 'monk'),
  comp('export_ok', 200, 'monk'), // exportable (default)
  comp('native_only', 200, 'terraformer', false),
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

describe('unlockComponent', () => {
  it('appends the token and charges its cost to spent', () => {
    const u = unit({ jpLedger: { earned: 300, spent: 0 } });
    const after = unlockComponent(u, tok('buyme'), CAT);
    expect(after.unlocks.map(tokenKey)).toEqual(['ability:buyme']);
    expect(after.jpLedger).toEqual({ earned: 300, spent: 150 });
    expect(availableJp(after.jpLedger)).toBe(150);
  });

  it('does not mutate the input unit (immutable)', () => {
    const u = unit({ jpLedger: { earned: 300, spent: 0 } });
    unlockComponent(u, tok('buyme'), CAT);
    expect(u.unlocks).toEqual([]);
    expect(u.jpLedger.spent).toBe(0);
  });

  it('throws when the component is already unlocked', () => {
    const u = unit({ jpLedger: { earned: 300, spent: 0 }, unlocks: [tok('buyme')] });
    expect(() => unlockComponent(u, tok('buyme'), CAT)).toThrow(/already unlocked/);
  });

  it('throws when the unit cannot afford it', () => {
    const u = unit({ jpLedger: { earned: 200, spent: 0 } }); // 200 available
    expect(() => unlockComponent(u, tok('pricey'), CAT)).toThrow(/costs 300 JP but only 200/);
  });

  it('affordability counts already-spent JP', () => {
    const u = unit({ jpLedger: { earned: 300, spent: 200 } }); // 100 available
    expect(() => unlockComponent(u, tok('buyme'), CAT)).toThrow(/only 100 available/);
  });
});

describe('grants', () => {
  it('grantJp adds to earned and rejects negatives', () => {
    expect(grantJp(unit(), 120).jpLedger).toEqual({ earned: 120, spent: 0 });
    expect(() => grantJp(unit(), -1)).toThrow(/non-negative/);
  });

  it('tierGrantAmount is base(tier×100) + a bounded deterministic bonus', () => {
    for (const tier of [1, 2, 3] as const) {
      const amount = tierGrantAmount(tier, 12345);
      const base = GRANT_BASE_PER_TIER * tier;
      expect(amount).toBeGreaterThanOrEqual(base);
      expect(amount).toBeLessThan(base + GRANT_RANDOM_RANGE);
    }
  });

  it('is deterministic in (tier, seed)', () => {
    expect(tierGrantAmount(3, 999)).toBe(tierGrantAmount(3, 999));
    expect(grantOnClassUnlock(unit(), 2, 7).jpLedger.earned).toBe(tierGrantAmount(2, 7));
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

  it('a native-only passive can NEVER be equipped off its class, even if unlocked', () => {
    const u = unit({ classId: classId('knight'), unlocks: [tok('native_only')] });
    const gate = canEquipPassive(u, abilityId('native_only'), classId('knight'), CAT);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toMatch(/native-only/);
    // ...but it IS equippable in its own native class (terraformer).
    expect(canEquipPassive(u, abilityId('native_only'), classId('terraformer'), CAT).ok).toBe(true);
  });
});
