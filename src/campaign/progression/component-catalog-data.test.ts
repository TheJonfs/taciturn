// Guard for the ~110-entry production cost catalog. A mis-typed ability id, a
// wrong native class, or a mis-read cost fails HERE (loudly) rather than at
// runtime — the safety net for hand-entered budget-doc data.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { CLASS_TIER_MAP } from './tier-map.ts';
import { COMPONENT_CATALOG, COMPONENT_ENTRIES } from './component-catalog-data.ts';
import { tokenKey } from './tokens.ts';

const catalog = loadDefaultCatalog();

// Budget-doc near-master totals (m2-jp-costing-budget.md). The per-class sums
// of the entered costs must match these exactly.
const EXPECTED_CLASS_TOTALS: Readonly<Record<string, number>> = {
  monk: 1750,
  earth_mage: 1800, // Biomastery settled at 450 (Conductor-capped)
  fire_mage: 1850,
  water_mage: 1550,
  alchemist: 1350,
  hunter: 1350,
  lightning_mage: 1950,
  knight: 1450,
  thief: 1600,
  enchanter: 1750,
  templar: 1400,
  terraformer: 1800,
  assassin: 1550,
  calculator: 2400,
};

// Includes the TABA Thessaly-exclusive `xp` / `square` components.
const MATH_PARAMS = new Set(['ct', 'height', 'level', 'current_hp', 'xp']);
const MATH_VALUES = new Set(['prime', 'square', 3, 4, 5]);

describe('COMPONENT_CATALOG data integrity', () => {
  it('builds without duplicate tokens (entry count === catalog size)', () => {
    expect(COMPONENT_CATALOG.size).toBe(COMPONENT_ENTRIES.length);
    // 114 base + 3 TABA unit-restricted (Hamstring, XP param, Square value).
    expect(COMPONENT_ENTRIES.length).toBe(117);
  });

  it('every ability token resolves to a real catalog ability', () => {
    for (const { token } of COMPONENT_ENTRIES) {
      if (token.kind === 'ability') {
        expect(catalog.hasAbility(token.id), `missing ability ${tokenKey(token)}`).toBe(true);
      }
    }
  });

  it('every item token resolves to a real catalog item', () => {
    for (const { token } of COMPONENT_ENTRIES) {
      if (token.kind === 'item') {
        expect(catalog.hasItem(token.id), `missing item ${tokenKey(token)}`).toBe(true);
      }
    }
  });

  it('math component tokens use the closed Parameter / Value sets', () => {
    for (const { token } of COMPONENT_ENTRIES) {
      if (token.kind === 'mathParameter') expect(MATH_PARAMS.has(token.id)).toBe(true);
      if (token.kind === 'mathValue') expect(MATH_VALUES.has(token.id)).toBe(true);
    }
  });

  it('every native class is in the tier map; every cost is a positive integer', () => {
    for (const entry of COMPONENT_ENTRIES) {
      expect(CLASS_TIER_MAP.has(entry.nativeClass), `unmapped class ${String(entry.nativeClass)}`).toBe(
        true,
      );
      expect(Number.isInteger(entry.cost) && entry.cost > 0).toBe(true);
    }
  });

  it('per-class cost sums match the budget doc near-master totals', () => {
    // TABA: unit-restricted components (Sera's Hamstring, Thessaly's XP/Square)
    // are NOT part of a class's generic near-master budget — they're
    // plot-unique earned extras — so they're excluded from the per-class sum.
    const sums: Record<string, number> = {};
    for (const e of COMPONENT_ENTRIES) {
      if (e.restrictedToUnit !== undefined) continue;
      const key = String(e.nativeClass);
      sums[key] = (sums[key] ?? 0) + e.cost;
    }
    expect(sums).toEqual(EXPECTED_CLASS_TOTALS);
  });

  it('the three TABA unit-restricted components are scoped to their plot unit', () => {
    const restricted = COMPONENT_ENTRIES.filter((e) => e.restrictedToUnit !== undefined);
    expect(restricted).toHaveLength(3);
    for (const e of restricted) {
      expect(String(e.restrictedToUnit)).toMatch(/^plot-/);
    }
  });
});
