// Ch1 campaign-start roster + staggered joins (taba-ch1-authoring brief).
//
// The load-bearing check is `probeUnitStats` on every authored unit: it runs
// the REAL fold + createInitialState, so an illegal loadout/equipment combo
// (over-capacity, class-illegal gear) fails here instead of at first deploy.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { teamId } from '@engine/index.ts';
import {
  CH1_CHRIS_ALCHEMIST_JP,
  CH1_GENERIC_CLASSES,
  CH1_START_LEVEL,
  ch1StartingRoster,
  clioJoinUnit,
  rollCh1Generics,
  seraJoinUnit,
  thessalyJoinUnit,
} from './ch1-roster.ts';
import { PLOT_UNIT_IDS } from './plot-unit-ids.ts';
import { probeBattleFor } from './probe-battle.ts';
import { probeUnitStats } from './snapshot-fold.ts';
import { getNode } from './graph.ts';
import { M1_CAMPAIGN_GRAPH } from './node.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();

// A deterministic rng stub (linear congruential — tests only).
function stubRng(seed = 1): () => number {
  let n = seed;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

// Every authored unit must instantiate through the real fold. Probe against
// the canonical probe field (node-agnostic — equipment legality and loadout
// capacity are what's under test).
function expectFoldable(unit: CampaignUnit): void {
  const probe = probeBattleFor(getNode(M1_CAMPAIGN_GRAPH, M1_CAMPAIGN_GRAPH.startId));
  const stats = probeUnitStats(probe.template, unit, teamId('team_a'), catalog);
  expect(stats, `${unit.name} (${String(unit.id)}) should fold cleanly`).not.toBeNull();
}

describe('ch1StartingRoster', () => {
  const roster = ch1StartingRoster(stubRng(), catalog);

  it('seeds exactly Lumen + Chris + four generics, all at L1', () => {
    expect(roster).toHaveLength(6);
    expect(roster.map((u) => String(u.id)).slice(0, 2)).toEqual([
      String(PLOT_UNIT_IDS.lumen),
      String(PLOT_UNIT_IDS.chris),
    ]);
    expect(roster.every((u) => u.level === CH1_START_LEVEL)).toBe(true);
    // Clio/Thessaly/Sera are NOT seeded (staggered joins — S92 write-back).
    const ids = new Set(roster.map((u) => String(u.id)));
    expect(ids.has(String(PLOT_UNIT_IDS.clio))).toBe(false);
    expect(ids.has(String(PLOT_UNIT_IDS.thessaly))).toBe(false);
    expect(ids.has(String(PLOT_UNIT_IDS.sera))).toBe(false);
  });

  it('every starter folds cleanly through the real battle path', () => {
    for (const unit of roster) expectFoldable(unit);
  });

  it('Lumen carries the Wand of Lumen; the Geosage the Wand of the Deepwood', () => {
    expect(String(roster[0]!.equipment.rightHand)).toBe('wand_of_lumen');
    const geosage = roster.find((u) => String(u.classId) === 'earth_mage')!;
    expect(String(geosage.equipment.rightHand)).toBe('wand_of_deepwood');
  });

  it('Chris has the Alchemist dispensation: access override + JP trickle', () => {
    const chris = roster[1]!;
    expect(chris.classAccessOverride?.map(String)).toEqual(['knight', 'alchemist']);
    expect(chris.earnedByClass['alchemist']).toBe(CH1_CHRIS_ALCHEMIST_JP);
    expect(String(chris.equipment.rightHand)).toBe('iron_sword');
  });

  it('every starter arrives with its class kit seeded (usable, not a shell)', () => {
    expect(roster.every((u) => u.unlocks.length > 0)).toBe(true);
  });
});

describe('rollCh1Generics', () => {
  it('classes are fixed; names unique; Brave/Faith within 50–70', () => {
    const generics = rollCh1Generics(stubRng(7), catalog);
    expect(generics.map((u) => u.classId)).toEqual(CH1_GENERIC_CLASSES);
    expect(new Set(generics.map((u) => u.name)).size).toBe(4);
    for (const u of generics) {
      expect(u.brave).toBeGreaterThanOrEqual(50);
      expect(u.brave).toBeLessThanOrEqual(70);
      expect(u.faith).toBeGreaterThanOrEqual(50);
      expect(u.faith).toBeLessThanOrEqual(70);
      expect(u.gender === 'male' || u.gender === 'female').toBe(true);
    }
  });

  it('is deterministic given the same rng sequence', () => {
    const a = rollCh1Generics(stubRng(42), catalog);
    const b = rollCh1Generics(stubRng(42), catalog);
    expect(a).toEqual(b);
  });
});

describe('the staggered plot joins', () => {
  it('fixed join levels: Clio 2, Thessaly 3, Sera 5', () => {
    expect(clioJoinUnit(catalog).level).toBe(2);
    expect(thessalyJoinUnit(catalog).level).toBe(3);
    expect(seraJoinUnit(catalog).level).toBe(5);
  });

  it('join units fold cleanly and arrive kit-seeded (joinPlotUnit never seeds)', () => {
    for (const unit of [clioJoinUnit(catalog), thessalyJoinUnit(catalog), seraJoinUnit(catalog)]) {
      expectFoldable(unit);
      expect(unit.unlocks.length).toBeGreaterThan(0);
    }
  });
});
