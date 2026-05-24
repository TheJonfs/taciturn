// Level system substrate tests (Session 49).
//
// The Level mechanic is slot-based: slot 0 → L25 baseline; outward
// slots step ±1 per `slotLevelFor`. Effects:
//   - HP_modified = round(maxHpBase × (1 + 0.1 × (level - 25)))
//   - MP_modified = round(maxMpBase × (1 + 0.1 × (level - 25)))
//   - dominant_stat += 1 at level ≥ 27, -1 at level ≤ 23
//
// Covers: `slotLevelFor` mapping, `buildBaseStats` modifier application
// across the canonical level range, and a cross-validation between
// `classDominantStats` (used by buildBaseStats) and each ClassDefinition's
// `dominantStat` field (used by engine consumers). The cross-check
// fails loud if a class ships with mismatched declarations.

import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  BASELINE_LEVEL,
  buildBaseStats,
  slotLevelFor,
} from './built-team.ts';
import { classDominantStats } from '../classes/baseline-stats.ts';

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

describe('buildBaseStats — level modifier', () => {
  // Knight is PA-dominant; baseline HP 144 / MP 20 / PA 10 / MA 4 / SPD 9.
  const KNIGHT = classId('knight');
  // Water Mage is MA-dominant; baseline HP 102 / MP 60 / PA 4 / MA 12 / SPD 10.
  const WATER = classId('water_mage');
  // Assassin is SPD-dominant; baseline HP 96 / MP 24 / PA 6 / MA 3 / SPD 13.
  const ASSASSIN = classId('assassin');

  const BRAVE = 70;
  const FAITH = 70;

  it('L25 leaves stats untouched (baseline path)', () => {
    const stats = buildBaseStats(KNIGHT, BRAVE, FAITH, 25);
    expect(stats.maxHpBase).toBe(144);
    expect(stats.maxMpBase).toBe(20);
    expect(stats.pa).toBe(10);
    expect(stats.ma).toBe(4);
    expect(stats.spd).toBe(9);
  });

  it('omitting level defaults to L25 (back-compat with legacy callers)', () => {
    const explicit = buildBaseStats(KNIGHT, BRAVE, FAITH, 25);
    const implicit = buildBaseStats(KNIGHT, BRAVE, FAITH);
    expect(implicit).toEqual(explicit);
  });

  it('L24 applies -10% HP/MP, no dominant-stat shift', () => {
    const stats = buildBaseStats(KNIGHT, BRAVE, FAITH, 24);
    // 144 × 0.9 = 129.6 → 130; 20 × 0.9 = 18.
    expect(stats.maxHpBase).toBe(130);
    expect(stats.maxMpBase).toBe(18);
    // |Δ| < 2, no dominant-stat shift.
    expect(stats.pa).toBe(10);
  });

  it('L26 applies +10% HP/MP, no dominant-stat shift', () => {
    const stats = buildBaseStats(KNIGHT, BRAVE, FAITH, 26);
    // 144 × 1.1 = 158.4 → 158; 20 × 1.1 = 22.
    expect(stats.maxHpBase).toBe(158);
    expect(stats.maxMpBase).toBe(22);
    expect(stats.pa).toBe(10);
  });

  it('L23 applies -20% HP/MP and -1 to the dominant stat', () => {
    const knightStats = buildBaseStats(KNIGHT, BRAVE, FAITH, 23);
    // 144 × 0.8 = 115.2 → 115; 20 × 0.8 = 16.
    expect(knightStats.maxHpBase).toBe(115);
    expect(knightStats.maxMpBase).toBe(16);
    // Knight is PA-dominant — PA drops 10 → 9.
    expect(knightStats.pa).toBe(9);
    expect(knightStats.ma).toBe(4);
    expect(knightStats.spd).toBe(9);
  });

  it('L27 applies +20% HP/MP and +1 to the dominant stat', () => {
    const knightStats = buildBaseStats(KNIGHT, BRAVE, FAITH, 27);
    // 144 × 1.2 = 172.8 → 173; 20 × 1.2 = 24.
    expect(knightStats.maxHpBase).toBe(173);
    expect(knightStats.maxMpBase).toBe(24);
    // Knight PA 10 → 11.
    expect(knightStats.pa).toBe(11);
  });

  it('targets the correct dominant stat per class', () => {
    // Water Mage at L27 — MA bumps; PA and SPD unchanged.
    const water = buildBaseStats(WATER, BRAVE, FAITH, 27);
    expect(water.ma).toBe(13);
    expect(water.pa).toBe(4);
    expect(water.spd).toBe(10);

    // Assassin at L23 — SPD drops; PA and MA unchanged.
    const assassin = buildBaseStats(ASSASSIN, BRAVE, FAITH, 23);
    expect(assassin.spd).toBe(12);
    expect(assassin.pa).toBe(6);
    expect(assassin.ma).toBe(3);
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
