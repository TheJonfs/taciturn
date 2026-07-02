// Level system substrate tests (Session 49; S50 cap retune; M2 curve
// replacement, ADR-0137).
//
// Level maps to base stats via the M2 per-class curve (`leveledClassStats`,
// tested in full against the brief's L1/L25/L50 tables in
// `../classes/stat-curves.test.ts`). This file covers the *substrate*
// around that curve:
//   - `slotLevelFor` mapping (slot 0 → L25; outward slots step ±1).
//   - `buildBaseStats` composes the curve's five stats with the player's
//     Brave/Faith and the uniform crit defaults, and defaults level to L25.
//   - a cross-validation between `classDominantStats` and each
//     ClassDefinition's `dominantStat` field (used by engine consumers —
//     e.g. Math Skill). The cross-check fails loud if a class ships with
//     mismatched declarations.
//
// (The S49/S50 ±10%-HP/MP + dominant-stat-±1 modifier this file used to
// assert was replaced wholesale by the curve; L25 still reproduces §5.)

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  BASELINE_LEVEL,
  buildBaseStats,
  slotLevelFor,
} from './built-team.ts';
import { classDominantStats } from '../classes/baseline-stats.ts';
import { leveledClassStats } from '../classes/stat-curves.ts';

describe('slotLevelFor', () => {
  it('maps the v1 5v5 slot range per the brief', () => {
    expect(slotLevelFor(0)).toBe(25);
    expect(slotLevelFor(1)).toBe(24);
    expect(slotLevelFor(2)).toBe(26);
    expect(slotLevelFor(3)).toBe(23);
    expect(slotLevelFor(4)).toBe(27);
  });

  it('extends the alternating pattern beyond 5v5', () => {
    expect(slotLevelFor(5)).toBe(22);
    expect(slotLevelFor(6)).toBe(28);
    expect(slotLevelFor(7)).toBe(21);
    expect(slotLevelFor(8)).toBe(29);
  });

  it('negative input falls back to baseline (defensive)', () => {
    expect(slotLevelFor(-1)).toBe(BASELINE_LEVEL);
  });
});

describe('buildBaseStats — curve composition', () => {
  // Knight baseline (§5): HP 144 / MP 20 / PA 10 / MA 4 / SPD 8.
  const KNIGHT = classId('knight');

  const BRAVE = 70;
  const FAITH = 70;

  it('L25 reproduces the §5 stat block (Mage-War-safety anchor)', () => {
    const stats = buildBaseStats(KNIGHT, BRAVE, FAITH, 25);
    expect(stats.maxHpBase).toBe(144);
    expect(stats.maxMpBase).toBe(20);
    expect(stats.pa).toBe(10);
    expect(stats.ma).toBe(4);
    expect(stats.spd).toBe(8);
  });

  it('omitting level defaults to L25 (back-compat with legacy callers)', () => {
    const explicit = buildBaseStats(KNIGHT, BRAVE, FAITH, 25);
    const implicit = buildBaseStats(KNIGHT, BRAVE, FAITH);
    expect(implicit).toEqual(explicit);
  });

  it('delegates the five level-driven stats to leveledClassStats', () => {
    // buildBaseStats is a thin composition over the curve — assert it
    // matches the curve at an off-anchor level rather than re-deriving the
    // numbers here (the curve itself is verified in stat-curves.test.ts).
    for (const level of [1, 24, 27, 50]) {
      const built = buildBaseStats(KNIGHT, BRAVE, FAITH, level);
      const curve = leveledClassStats(KNIGHT, level);
      expect(built.maxHpBase).toBe(curve.maxHpBase);
      expect(built.maxMpBase).toBe(curve.maxMpBase);
      expect(built.pa).toBe(curve.pa);
      expect(built.ma).toBe(curve.ma);
      expect(built.spd).toBe(curve.spd);
    }
  });

  it('layers the player Brave/Faith and uniform crit defaults on top', () => {
    const stats = buildBaseStats(KNIGHT, 61, 44, 25);
    expect(stats.brave).toBe(61);
    expect(stats.faith).toBe(44);
    expect(stats.crit_chance).toBe(5);
    expect(stats.crit_multiplier).toBe(1.5);
  });
});

describe('classDominantStats parity with ClassDefinition.dominantStat', () => {
  it('each catalog class has a matching entry in classDominantStats', () => {
    const catalog = loadDefaultCatalog();
    for (const cls of catalog.classes()) {
      const expected = classDominantStats.get(cls.id);
      expect(
        expected,
        `classDominantStats missing entry for ${String(cls.id)}`,
      ).toBeDefined();
      expect(
        cls.dominantStat,
        `ClassDefinition for ${String(cls.id)} disagrees with classDominantStats`,
      ).toBe(expected);
    }
  });
});
