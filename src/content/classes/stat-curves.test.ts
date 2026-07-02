// M2 per-class base-stat curve tests (ADR-0137).
//
// The load-bearing checks:
//   1. The curve reproduces the brief's L1 / L25 / L50 verification tables
//      for all 14 classes with the correct per-stat rounding.
//   2. **L25 reproduces the §5 stat block exactly** (`classBaselineStats`) —
//      the Mage-War-safety invariant.
//   3. MA continues on the quadratic past L50 (uncapped); Speed clamps to
//      its L50 value past L50; PA/HP/MP extend linearly.

import { describe, expect, it } from 'vitest';
import { classId, type ClassId } from '@engine/index.ts';
import { classBaselineStats } from './baseline-stats.ts';
import { leveledClassStats, maCurve, spdCurve } from './stat-curves.ts';

// The brief's verification tables, keyed by code class id (display names
// map: Geosage=earth_mage, Hydrologist=water_mage, Pyromancer=fire_mage,
// Aethurge=lightning_mage). Each entry is [L1, L25, L50].
interface CurveRow {
  readonly pa: readonly [number, number, number];
  readonly ma: readonly [number, number, number];
  readonly hp: readonly [number, number, number];
  readonly mp: readonly [number, number, number];
  readonly spd: readonly [number, number, number];
}

const TABLE: ReadonlyArray<readonly [string, CurveRow]> = [
  ['knight', { pa: [4, 10, 18], ma: [1, 4, 10], hp: [46, 144, 247], mp: [6, 20, 36], spd: [5, 8, 10] }],
  ['monk', { pa: [3, 9, 16], ma: [1, 4, 10], hp: [60, 190, 326], mp: [8, 26, 46], spd: [6, 10, 13] }],
  ['alchemist', { pa: [3, 8, 14], ma: [1, 5, 12], hp: [40, 126, 216], mp: [10, 36, 64], spd: [7, 11, 14] }],
  ['hunter', { pa: [3, 7, 13], ma: [1, 5, 12], hp: [37, 116, 199], mp: [8, 28, 50], spd: [6, 10, 13] }],
  ['thief', { pa: [3, 7, 13], ma: [1, 3, 8], hp: [29, 90, 155], mp: [8, 28, 50], spd: [7, 11, 14] }],
  ['assassin', { pa: [2, 6, 11], ma: [1, 3, 8], hp: [31, 96, 165], mp: [7, 24, 43], spd: [8, 13, 17] }],
  ['templar', { pa: [2, 6, 11], ma: [2, 6, 15], hp: [42, 132, 227], mp: [10, 36, 64], spd: [5, 8, 10] }],
  ['terraformer', { pa: [2, 6, 11], ma: [2, 8, 19], hp: [34, 105, 180], mp: [10, 35, 62], spd: [5, 8, 10] }],
  ['calculator', { pa: [2, 5, 9], ma: [2, 9, 22], hp: [32, 101, 173], mp: [11, 37, 66], spd: [5, 7, 9] }],
  ['earth_mage', { pa: [2, 4, 7], ma: [3, 12, 29], hp: [36, 112, 192], mp: [13, 48, 85], spd: [5, 8, 10] }],
  ['water_mage', { pa: [2, 4, 7], ma: [3, 12, 29], hp: [33, 102, 175], mp: [13, 48, 85], spd: [6, 10, 13] }],
  ['fire_mage', { pa: [2, 4, 7], ma: [3, 13, 31], hp: [31, 97, 167], mp: [13, 48, 85], spd: [6, 9, 12] }],
  ['lightning_mage', { pa: [2, 4, 7], ma: [3, 14, 33], hp: [28, 87, 150], mp: [13, 48, 85], spd: [6, 9, 12] }],
  ['enchanter', { pa: [1, 3, 6], ma: [2, 10, 24], hp: [33, 103, 177], mp: [11, 40, 71], spd: [6, 10, 13] }],
];

const LEVELS = [1, 25, 50] as const;

describe('leveledClassStats — brief verification tables (L1 / L25 / L50)', () => {
  for (const [name, row] of TABLE) {
    describe(name, () => {
      const cls = classId(name);
      for (let i = 0; i < LEVELS.length; i++) {
        const level = LEVELS[i]!;
        it(`L${level} matches the brief`, () => {
          const s = leveledClassStats(cls, level);
          expect(s.pa, 'PA').toBe(row.pa[i]);
          expect(s.ma, 'MA').toBe(row.ma[i]);
          expect(s.maxHpBase, 'HP').toBe(row.hp[i]);
          expect(s.maxMpBase, 'MP').toBe(row.mp[i]);
          expect(s.spd, 'SPD').toBe(row.spd[i]);
        });
      }
    });
  }
});

describe('L25 reproduces the §5 stat block exactly (Mage-War-safety invariant)', () => {
  for (const [id, anchor] of classBaselineStats) {
    it(`${String(id)} L25 == classBaselineStats`, () => {
      const s = leveledClassStats(id, 25);
      expect(s.pa).toBe(anchor.pa);
      expect(s.ma).toBe(anchor.ma);
      expect(s.maxHpBase).toBe(anchor.maxHpBase);
      expect(s.maxMpBase).toBe(anchor.maxMpBase);
      expect(s.spd).toBe(anchor.spd);
    });
  }
});

describe('past-L50 behavior', () => {
  const AETHURGE = classId('lightning_mage'); // highest MA anchor (14)
  const ASSASSIN = classId('assassin'); // highest Speed anchor (13)

  it('MA continues on the quadratic past L50, uncapped', () => {
    const l50 = leveledClassStats(AETHURGE, 50).ma;
    const l75 = leveledClassStats(AETHURGE, 75).ma;
    const l100 = leveledClassStats(AETHURGE, 100).ma;
    // Strictly accelerating, and well past the old 99 ceiling by L100.
    expect(l75).toBeGreaterThan(l50);
    expect(l100).toBeGreaterThan(l75);
    // Quadratic (not linear): the L75→L100 gain exceeds the L50→L75 gain.
    expect(l100 - l75).toBeGreaterThan(l75 - l50);
    // Aethurge base MA ~93 at L100 per the brief — no ≤99 clamp is applied
    // (uncapped is the design; the float curve is free to exceed 99).
    expect(maCurve(14, 100)).toBeGreaterThan(90);
  });

  it('Speed plateaus at its L50 value past L50', () => {
    const l50 = leveledClassStats(ASSASSIN, 50).spd;
    expect(leveledClassStats(ASSASSIN, 51).spd).toBe(l50);
    expect(leveledClassStats(ASSASSIN, 75).spd).toBe(l50);
    expect(leveledClassStats(ASSASSIN, 200).spd).toBe(l50);
    // The float curve itself flattens, not just the rounded output.
    expect(spdCurve(13, 200)).toBe(spdCurve(13, 50));
  });

  it('Speed keeps the 99 cap (academic — base tops out ~17)', () => {
    // No base class approaches 99; the cap is a guardrail, not active.
    for (const [id] of classBaselineStats) {
      expect(leveledClassStats(id, 500).spd).toBeLessThanOrEqual(99);
    }
  });

  it('PA / HP / MP extend linearly past L50', () => {
    // Two equal level steps past L50 yield equal stat gains (linear).
    const a = leveledClassStats(classId('knight'), 50);
    const b = leveledClassStats(classId('knight'), 75);
    const c = leveledClassStats(classId('knight'), 100);
    // Allow ±1 rounding wobble on the ceil'd integer outputs.
    expect(Math.abs((c.maxHpBase - b.maxHpBase) - (b.maxHpBase - a.maxHpBase))).toBeLessThanOrEqual(1);
    expect(Math.abs((c.maxMpBase - b.maxMpBase) - (b.maxMpBase - a.maxMpBase))).toBeLessThanOrEqual(1);
    expect(Math.abs((c.pa - b.pa) - (b.pa - a.pa))).toBeLessThanOrEqual(1);
  });
});

describe('unregistered class fails loud', () => {
  it('throws for an unknown class id', () => {
    expect(() => leveledClassStats('not_a_class' as ClassId, 25)).toThrow(/no baseline stats/);
  });
});
