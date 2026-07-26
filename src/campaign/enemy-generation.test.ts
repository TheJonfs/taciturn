// TABA M4 — unified composer tests: the acceptance pins.
//
// The load-bearing invariants (brief): NO UNIQUE EVER on a generated enemy
// (unclamped tiering makes the Ch3 pool reachable, so the filter is
// load-bearing, not tidy); no exotics; every generated build passes the
// SHARED draft-legality resolver; determinism.

import { describe, expect, it } from 'vitest';
import { bucketId, validateDraftUnit, rulesetId } from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import { ENEMY_GEAR_GIL_PER_LEVEL } from './economy-config.ts';
import { composeEnemyBuild } from './enemy-generation.ts';
import { enemyGearChapterCeiling } from './enemy-gear.ts';
import { TABA_GEAR_POOL } from './equipment-pool.ts';
import { itemPrice } from './shop.ts';
import { CLASS_TIER_MAP, tierEntryOf, COMPONENT_CATALOG, tokenKey } from './progression/index.ts';

const catalog = loadDefaultCatalog();
const RULESET = rulesetId('default');
const CLASSES = [...CLASS_TIER_MAP.keys()];

const UNIQUE_IDS = new Set(
  TABA_GEAR_POOL.filter((e) => e.acquisition === 'unique').map((e) => String(e.itemId)),
);
const EXOTIC_IDS = new Set(
  TABA_GEAR_POOL.filter((e) => e.exotic === true).map((e) => String(e.itemId)),
);

// The sweep the invariants are pinned over: every canonical class, levels
// across all three gear bands, several seeds.
const SWEEP_LEVELS = [1, 3, 7, 12, 13, 18, 24, 25, 30, 40];
const SWEEP_SEEDS = [0, 1, 0xdeadbeef];

function* sweep(): Generator<ReturnType<typeof composeEnemyBuild>> {
  for (const cls of CLASSES) {
    for (const level of SWEEP_LEVELS) {
      for (const seed of SWEEP_SEEDS) {
        yield composeEnemyBuild({ classId: cls, level, seed, catalog });
      }
    }
  }
}

describe('composeEnemyBuild — invariants (the acceptance pins)', () => {
  it('NO UNIQUE EVER appears on a generated enemy (the invariant, not a preference)', () => {
    for (const build of sweep()) {
      for (const id of Object.values(build.equipment)) {
        if (id !== null) expect(UNIQUE_IDS.has(String(id))).toBe(false);
      }
    }
  });

  it('no exotic/marquee effect item appears on a generated enemy', () => {
    for (const build of sweep()) {
      for (const id of Object.values(build.equipment)) {
        if (id !== null) expect(EXOTIC_IDS.has(String(id))).toBe(false);
      }
    }
  });

  it('every generated build passes the SHARED draft-legality resolver', () => {
    for (const cls of CLASSES) {
      for (const level of SWEEP_LEVELS) {
        const build = composeEnemyBuild({ classId: cls, level, seed: 7, catalog });
        const legality = validateDraftUnit(
          { classId: cls, loadout: build.loadout, equipment: build.equipment },
          catalog,
          RULESET,
        );
        expect(legality.valid, `${String(cls)} L${level}: ${JSON.stringify(legality)}`).toBe(true);
      }
    }
  });

  it('no restricted (unit-signature) component ever spawns on a generated enemy', () => {
    for (const build of sweep()) {
      for (const token of build.unlocks) {
        const meta = COMPONENT_CATALOG.get(tokenKey(token));
        expect(meta?.restrictedToUnit).toBeUndefined();
      }
    }
  });

  it('is deterministic: same (class, level, seed) → deep-equal build', () => {
    for (const cls of CLASSES.slice(0, 4)) {
      const a = composeEnemyBuild({ classId: cls, level: 20, seed: 99, catalog });
      const b = composeEnemyBuild({ classId: cls, level: 20, seed: 99, catalog });
      expect(a).toEqual(b);
    }
  });
});

describe('composeEnemyBuild — loadout deployment (WI2)', () => {
  it('fills R/S/M past the innates at any level (native passives are free in-class)', () => {
    // A monk has native curriculum passives; even an L1 fills what fits —
    // the same power a player unit has from creation (parity, not budget).
    const build = composeEnemyBuild({ classId: CLASSES[0]!, level: 1, seed: 1, catalog });
    const equipped = Object.values(build.loadout.passiveBuckets).flat();
    expect(equipped.length).toBeGreaterThan(0);
  });

  it('budget spillover wields a secondary command set (learned = equipped)', () => {
    // At a high level the budget clears the primary tree and diversifies;
    // at L1 it cannot. Check across seeds that highs get a secondary.
    const secondaryAt = (level: number): boolean =>
      SWEEP_SEEDS.some((seed) => {
        const build = composeEnemyBuild({ classId: CLASSES[0]!, level, seed, catalog });
        return (build.loadout.actionBuckets[bucketId('secondary_command_sets')] ?? []).length > 0;
      });
    expect(secondaryAt(40)).toBe(true);
    expect(secondaryAt(1)).toBe(false);
  });

  it('the pair class never exceeds the primary tier (no Tier-3 secondaries on grunts)', () => {
    for (const cls of CLASSES) {
      for (const seed of SWEEP_SEEDS) {
        const build = composeEnemyBuild({ classId: cls, level: 40, seed, catalog });
        if (build.secondaryClass !== undefined) {
          expect(tierEntryOf(build.secondaryClass).tier).toBeLessThanOrEqual(
            tierEntryOf(cls).tier,
          );
        }
      }
    }
  });

  it('budget legibility: a lower level knows strictly less (kit prefix discipline)', () => {
    const low = composeEnemyBuild({ classId: CLASSES[0]!, level: 2, seed: 5, catalog });
    const high = composeEnemyBuild({ classId: CLASSES[0]!, level: 25, seed: 5, catalog });
    expect(low.unlocks.length).toBeGreaterThan(0);
    expect(low.unlocks.length).toBeLessThan(high.unlocks.length);
  });
});

describe('the gil purse (S99 cont. — level-budgeted armor slots)', () => {
  const knight = CLASSES.find((c) => String(c) === 'knight')!;
  const paidSpend = (build: ReturnType<typeof composeEnemyBuild>): number =>
    (['leftHand', 'headgear', 'armor', 'accessory'] as const).reduce((sum, slot) => {
      const id = build.equipment[slot];
      return id === null ? sum : sum + itemPrice(id);
    }, 0);

  it('the weapon is free: even an L1 enemy of a weapon-capable class is armed', () => {
    const build = composeEnemyBuild({ classId: knight, level: 1, seed: 2, catalog });
    expect(build.equipment.rightHand).not.toBeNull();
  });

  it('paid slots never exceed the purse (price-tuning-proof invariant)', () => {
    for (const cls of CLASSES) {
      for (const level of SWEEP_LEVELS) {
        const build = composeEnemyBuild({ classId: cls, level, seed: 11, catalog });
        expect(paidSpend(build)).toBeLessThanOrEqual(level * ENEMY_GEAR_GIL_PER_LEVEL);
      }
    }
  });

  it('low levels field a sparse wardrobe; high levels a fuller one', () => {
    const pieces = (level: number): number =>
      (['leftHand', 'headgear', 'armor', 'accessory'] as const).filter(
        (slot) =>
          composeEnemyBuild({ classId: knight, level, seed: 4, catalog }).equipment[slot] !==
          null,
      ).length;
    expect(pieces(2)).toBeLessThanOrEqual(2); // Chris's dial target: L≤5 ≈ 1-2 pieces
    expect(pieces(2)).toBeLessThanOrEqual(pieces(30));
    expect(pieces(30)).toBeGreaterThanOrEqual(3); // the purse stops binding
  });
});

describe('enemyGearChapterCeiling — the level bands (WI3)', () => {
  it('band 1 (L1-12) is all Ch1 regardless of roll', () => {
    for (const level of [1, 6, 12]) {
      expect(enemyGearChapterCeiling(level, 0)).toBe(1);
      expect(enemyGearChapterCeiling(level, 0.999)).toBe(1);
    }
  });

  it('band entry ramps: L13 is ~10% Ch2; L24 is fully Ch2', () => {
    expect(enemyGearChapterCeiling(13, 0.05)).toBe(2);
    expect(enemyGearChapterCeiling(13, 0.5)).toBe(1);
    expect(enemyGearChapterCeiling(24, 0.999)).toBe(2);
  });

  it('band 3 (L25+) ramps to unclamped Ch3 gear', () => {
    expect(enemyGearChapterCeiling(25, 0.05)).toBe(3);
    expect(enemyGearChapterCeiling(25, 0.5)).toBe(2);
    expect(enemyGearChapterCeiling(36, 0.999)).toBe(3);
    expect(enemyGearChapterCeiling(50, 0.999)).toBe(3);
  });

  it('generated gear respects the band: an L12 enemy wears only Ch1 gear', () => {
    const chapterOf = new Map(TABA_GEAR_POOL.map((e) => [String(e.itemId), e.chapter]));
    for (const cls of CLASSES) {
      const build = composeEnemyBuild({ classId: cls, level: 12, seed: 3, catalog });
      for (const id of Object.values(build.equipment)) {
        if (id !== null) expect(chapterOf.get(String(id))).toBe(1);
      }
    }
  });

  it('a high-level enemy in any story chapter carries late gear (unclamped, the peek)', () => {
    const chapterOf = new Map(TABA_GEAR_POOL.map((e) => [String(e.itemId), e.chapter]));
    // At L40 every slot rolls the full Ch3 pool; at least one class lands a
    // Ch3 piece (the pools are Ch3-dominated at that rank).
    const anyCh3 = CLASSES.some((cls) => {
      const build = composeEnemyBuild({ classId: cls, level: 40, seed: 3, catalog });
      return Object.values(build.equipment).some(
        (id) => id !== null && chapterOf.get(String(id)) === 3,
      );
    });
    expect(anyCh3).toBe(true);
  });
});
