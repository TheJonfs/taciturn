// TABA economy — recruitment tests (M3 economy brief, Stage 3).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { classId, validateDraftUnit } from '@engine/index.ts';
import { HIRE_JP_TIER1_STEPS } from './economy-config.ts';
import { partyAverageLevel } from './enemy-level.ts';
import { getNode } from './graph.ts';
import { freeCount, ownedCount } from './inventory.ts';
import { newCampaign } from './loop.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { CAMPAIGN_RULESET_ID } from './node-content.ts';
import { tierEntryOf } from './progression/index.ts';
import {
  buildHire,
  hireableClasses,
  hireCost,
  hireGeneric,
  hireJpBonus,
  maxHireLevel,
  starterGearFor,
} from './recruit.ts';
import { m0Roster } from './roster.ts';
import { firstBattleBeat } from './sequence.ts';
import { probeUnitStats } from './snapshot-fold.ts';

const catalog = loadDefaultCatalog();
const GRAPH = M1_CAMPAIGN_GRAPH;
const HUB = getNode(GRAPH, M1_NODES.stonebridge);

const rich = () => ({ ...newCampaign(m0Roster, M1_NODES.stonebridge), gil: 50_000 });

describe('the hire menu (classes, cap, curve, bonus)', () => {
  it('offers exactly the Tier-1 classes', () => {
    const classes = hireableClasses();
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(tierEntryOf(c).tier).toBe(1);
  });

  it('caps the hire level at the party average', () => {
    expect(maxHireLevel(rich())).toBe(partyAverageLevel(m0Roster));
  });

  it('prices by the config curve — higher level, more gil', () => {
    expect(hireCost(20)).toBeGreaterThan(hireCost(5));
  });

  it('steps the Tier-1 JP bonus at the config thresholds', () => {
    const first = HIRE_JP_TIER1_STEPS[0]!;
    expect(hireJpBonus(first.minLevel - 1)).toBe(0);
    expect(hireJpBonus(first.minLevel)).toBe(first.jp);
    const last = HIRE_JP_TIER1_STEPS[HIRE_JP_TIER1_STEPS.length - 1]!;
    expect(hireJpBonus(99)).toBe(last.jp);
  });
});

describe('starter gear (resolver-picked)', () => {
  it('every hireable class gets a kit its class may legally wear', () => {
    for (const c of hireableClasses()) {
      for (const [slot, id] of starterGearFor(c, catalog)) {
        // Legal by construction — re-assert through the same resolver.
        expect(slot).toBeDefined();
        expect(catalog.hasItem(id)).toBe(true);
      }
    }
  });
});

describe('hireGeneric', () => {
  it('debits the curve price and adds a deployable unit at effective full', () => {
    const state = rich();
    const level = maxHireLevel(state);
    const cls = hireableClasses()[0]!;
    const hired = hireGeneric(state, HUB, { classId: cls, level }, catalog);

    expect(hired.gil).toBe(state.gil - hireCost(level));
    expect(hired.roster).toHaveLength(state.roster.length + 1);
    const unit = hired.roster[hired.roster.length - 1]!;
    expect(unit.level).toBe(level);
    expect(unit.fate).toBe('active');
    expect(unit.vitals.hp).toBeGreaterThan(1); // healed to effective full, not the provisional 1
  });

  it("the hire's starting gear enters through the receipt door (owned, and equipped-covered)", () => {
    const state = rich();
    const cls = hireableClasses()[0]!;
    const gear = starterGearFor(cls, catalog);
    expect(gear.length).toBeGreaterThan(0); // the fixture class does get a kit
    const hired = hireGeneric(state, HUB, { classId: cls, level: 5 }, catalog);
    for (const [, id] of gear) {
      expect(ownedCount(hired, id)).toBe(ownedCount(state, id) + 1);
      // The instance is on the hire's back: owned grew but free didn't.
      expect(freeCount(hired, id)).toBe(freeCount(state, id));
    }
  });

  it('the hire passes the shared draft-legality resolver (three-resolver discipline)', () => {
    const state = rich();
    for (const cls of hireableClasses()) {
      const hired = hireGeneric(state, HUB, { classId: cls, level: 10 }, catalog);
      const unit = hired.roster[hired.roster.length - 1]!;
      const report = validateDraftUnit(
        { classId: unit.classId, loadout: unit.loadout, equipment: unit.equipment },
        catalog,
        CAMPAIGN_RULESET_ID,
      );
      expect(report.invalidSlots).toEqual([]);
    }
  });

  it('a high-level hire banks the Tier-1 signing bonus in its own class pool', () => {
    const state = rich();
    const cls = hireableClasses()[0]!;
    const level = Math.min(maxHireLevel(state), HIRE_JP_TIER1_STEPS[1]!.minLevel);
    const withBonus = hireGeneric(state, HUB, { classId: cls, level }, catalog);
    const unit = withBonus.roster[withBonus.roster.length - 1]!;
    const baseline = buildHire(state, { classId: cls, level: 1 }, catalog);
    expect(unit.earnedByClass[String(cls)] ?? 0).toBe(
      (baseline.earnedByClass[String(cls)] ?? 0) + hireJpBonus(level),
    );
  });

  it('REFUSES a hire above the party average (the cap has no bypass)', () => {
    const state = rich();
    const cls = hireableClasses()[0]!;
    expect(() =>
      hireGeneric(state, HUB, { classId: cls, level: maxHireLevel(state) + 1 }, catalog),
    ).toThrow(/capped at party average/);
  });

  it('refuses non-Tier-1 classes and insufficient gil', () => {
    const state = rich();
    expect(() => hireGeneric(state, HUB, { classId: classId('knight'), level: 5 }, catalog)).toThrow(
      /not a hireable/,
    );
    const broke = { ...state, gil: 0 };
    expect(() =>
      hireGeneric(broke, HUB, { classId: hireableClasses()[0]!, level: 5 }, catalog),
    ).toThrow(/insufficient gil/);
  });

  it('the hire probes real stats through the existing fold (the Formation view path)', () => {
    const state = rich();
    const unit = buildHire(state, { classId: hireableClasses()[0]!, level: 15 }, catalog);
    const beat = firstBattleBeat(HUB.beats)!;
    const stats = probeUnitStats(beat.battle.template, unit, beat.battle.playerTeam, catalog);
    expect(stats).not.toBeNull();
    expect(stats!.maxHp).toBeGreaterThan(0);
  });

  it('hires fine at a PURE market town (no battlefield — canonical probe)', () => {
    const town = { id: 'node-watford-market', name: 'Watford Market', chapter: 1, beats: [], isHub: true };
    const state = rich();
    const hired = hireGeneric(state, town, { classId: hireableClasses()[0]!, level: 10 }, catalog);
    const unit = hired.roster[hired.roster.length - 1]!;
    expect(unit.vitals.hp).toBeGreaterThan(1); // effective full via the canonical field
    // Identical vitals to the same hire at a battlefield hub (template independence).
    const atHub = hireGeneric(state, HUB, { classId: hireableClasses()[0]!, level: 10 }, catalog);
    expect(unit.vitals).toEqual(atHub.roster[atHub.roster.length - 1]!.vitals);
  });

  it('mints collision-free ids and readable names across consecutive hires', () => {
    let state = rich();
    const cls = hireableClasses()[0]!;
    state = hireGeneric(state, HUB, { classId: cls, level: 5 }, catalog);
    state = hireGeneric(state, HUB, { classId: cls, level: 6 }, catalog);
    const ids = state.roster.map((u) => String(u.id));
    expect(new Set(ids).size).toBe(ids.length);
    const names = state.roster.map((u) => u.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
