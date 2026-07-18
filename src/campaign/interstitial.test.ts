// TABA campaign — presentational interstitial builder tests (the pure half).

import { describe, expect, it } from 'vitest';
import type { UnitId } from '@engine/index.ts';
import {
  buildLocationMenuBeat,
  buildResultSummaryBeat,
  buildRouteChoice,
  buildRouteChoiceBeat,
  buildUnitResultLines,
} from './interstitial.ts';
import { newCampaign } from './loop.ts';
import type { BattleResult, UnitBattleSummary } from './battle-result.ts';
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';
import { allNodeBeats, getNode } from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import { m0Roster } from './roster.ts';

const GRAPH = CAMPAIGN_GRAPH;
const START = getNode(GRAPH, CAMPAIGN_NODES.oskun); // the first battle node
const START_TEAM = firstBattleBeat(allNodeBeats(START))!.battle.playerTeam;

// A battle result where the first two roster units fought (survived / downed)
// and the rest sat in reserve (absent from the result).
function resultFor(roster = m0Roster): BattleResult {
  const units = new Map<UnitId, UnitBattleSummary>();
  units.set(roster[0]!.id, { id: roster[0]!.id, outcome: 'survived', vitals: { hp: 20, mp: 5 } });
  units.set(roster[1]!.id, { id: roster[1]!.id, outcome: 'downed', vitals: { hp: 0, mp: 0 } });
  return {
    outcome: { winner: START_TEAM, conditionIndex: 0, description: 'test' },
    units,
  };
}

describe('buildUnitResultLines', () => {
  it('includes only deployed units, in roster order, with battle outcomes', () => {
    const lines = buildUnitResultLines(m0Roster, resultFor());
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.id)).toEqual([m0Roster[0]!.id, m0Roster[1]!.id]);
    expect(lines[0]!.outcome).toBe('survived');
    expect(lines[1]!.outcome).toBe('downed');
    expect(lines[1]!.vitals).toEqual({ hp: 0, mp: 0 });
  });
});

describe('buildResultSummaryBeat', () => {
  it('win (non-terminal) → a win result-summary, not campaign-complete', () => {
    const beat = buildResultSummaryBeat({
      node: START,
      roster: m0Roster,
      result: resultFor(),
      won: true,
      campaignComplete: false,
      gilEarned: 120,
    });
    expect(beat.type).toBe('result-summary');
    expect(beat.resolution).toBe('win');
    expect(beat.campaignComplete).toBe(false);
    expect(beat.units).toHaveLength(2);
    expect(beat.nodeName).toBe(START.name);
    expect(beat.gilEarned).toBe(120);
  });

  it('terminal win → campaignComplete flag set (the victory screen)', () => {
    const beat = buildResultSummaryBeat({
      node: getNode(GRAPH, CAMPAIGN_NODES.rukVillage),
      roster: m0Roster,
      result: resultFor(),
      won: true,
      campaignComplete: true,
      gilEarned: 120,
    });
    expect(beat.campaignComplete).toBe(true);
  });

  it('loss → a loss result-summary (advance = retry; never campaign-complete)', () => {
    const beat = buildResultSummaryBeat({
      node: START,
      roster: m0Roster,
      result: resultFor(),
      won: false,
      campaignComplete: false,
      gilEarned: 0, // losses pay nothing
    });
    expect(beat.resolution).toBe('loss');
    expect(beat.campaignComplete).toBe(false);
    expect(beat.gilEarned).toBe(0);
  });
});

describe('buildRouteChoiceBeat / buildRouteChoice', () => {
  // A campaign that just cleared Oskun (the first battle node).
  const clearedStart = {
    ...newCampaign(m0Roster, CAMPAIGN_NODES.oskun),
    clearedStoryBeats: [CAMPAIGN_NODES.oskun],
    gil: 340,
  };

  it('builds a world-map-choice from the travel model (frontier + returnables)', () => {
    const beat = buildRouteChoiceBeat(GRAPH, clearedStart);
    expect(beat.type).toBe('world-map-choice');
    expect(beat.fromNodeId).toBe(CAMPAIGN_NODES.oskun);
    // The next spine stop (frontier)… plus the cleared farmable node
    // itself as a returnable (M3 economy Stage 1).
    expect(beat.choices.map((c) => c.id)).toEqual([
      CAMPAIGN_NODES.alvera,
      CAMPAIGN_NODES.oskun,
    ]);
    expect(beat.choices.map((c) => c.kind)).toEqual(['advance', 'revisit']);
    // The purse snapshot rides the beat (M3 economy Stage 0).
    expect(beat.gil).toBe(340);
  });

  it('buildRouteChoice wraps it as a single-beat run (resume into awaiting_route)', () => {
    const beats = buildRouteChoice(GRAPH, clearedStart);
    expect(beats.map((b) => b.type)).toEqual(['world-map-choice']);
  });

  it('carries the new-stock hub set for the map badge (S95 WI2)', () => {
    // Old Ordal's clear landed the Staff + Tome in Alvera, whose seen record
    // still holds only wave 1 (empty here) — the beat flags Alvera.
    const backHalf = {
      ...newCampaign(m0Roster, CAMPAIGN_NODES.oldOrdal),
      clearedStoryBeats: [CAMPAIGN_NODES.alvera, CAMPAIGN_NODES.oldOrdal],
      visited: [CAMPAIGN_NODES.alvera, CAMPAIGN_NODES.oldOrdal],
      shopStockSeen: {},
    };
    const beat = buildRouteChoiceBeat(GRAPH, backHalf);
    expect(beat.newStock).toContain(CAMPAIGN_NODES.alvera);
  });
});

describe('buildLocationMenuBeat', () => {
  it('offers a skirmish (with the resolved level) at a cleared farmable node', () => {
    const state = {
      ...newCampaign(m0Roster, CAMPAIGN_NODES.oskun),
      clearedStoryBeats: [CAMPAIGN_NODES.oskun],
      gil: 75,
    };
    const beat = buildLocationMenuBeat(START, state);
    expect(beat.type).toBe('location-menu');
    expect(beat.nodeId).toBe(CAMPAIGN_NODES.oskun);
    expect(beat.gil).toBe(75);
    expect(beat.options.map((o) => o.action)).toEqual(['skirmish']);
    // The detail names the resolved enemy level (party avg + offset).
    expect(beat.options[0]!.detail).toMatch(/enemy level/i);
  });

  it('offers the armed story AND the shop at an uncleared hub (pure builder; the S94 story-first driver bypasses this menu)', () => {
    const alvera = getNode(GRAPH, CAMPAIGN_NODES.alvera);
    const state = {
      ...newCampaign(m0Roster, CAMPAIGN_NODES.alvera),
      visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun],
    };
    const beat = buildLocationMenuBeat(alvera, state);
    expect(beat.options.map((o) => o.action)).toEqual(['story', 'shop', 'recruit']);
  });

  it('offers skirmish AND shop at a cleared FARMABLE hub (the valve + commerce coexist)', () => {
    // Ch1 authors no farmable hub (Alvera trades, Oskun farms) — the
    // coexistence shape stays pinned on a synthetic capability overlay.
    const farmableHub = { ...getNode(GRAPH, CAMPAIGN_NODES.alvera), farmable: true };
    const state = {
      ...newCampaign(m0Roster, CAMPAIGN_NODES.alvera),
      visited: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
      clearedStoryBeats: [CAMPAIGN_NODES.oskun, CAMPAIGN_NODES.alvera],
    };
    const beat = buildLocationMenuBeat(farmableHub, state);
    expect(beat.options.map((o) => o.action)).toEqual(['skirmish', 'shop', 'recruit']);
  });

  it('a PURE market town (no beats) offers commerce only, from first visit', () => {
    const town = { id: 'node-watford-market', name: 'Watford Market', chapter: 1, engagements: [], isHub: true };
    const state = {
      ...newCampaign(m0Roster, town.id),
      visited: [CAMPAIGN_NODES.oskun, town.id],
    };
    const beat = buildLocationMenuBeat(town, state);
    expect(beat.options.map((o) => o.action)).toEqual(['shop', 'recruit']);
  });

  it('offers nothing at a cleared node with no open capabilities', () => {
    // Old Ordal: the Ch1 dead node — never farmable/hub.
    const oldOrdal = getNode(GRAPH, CAMPAIGN_NODES.oldOrdal);
    const state = {
      ...newCampaign(m0Roster, CAMPAIGN_NODES.oldOrdal),
      clearedStoryBeats: [CAMPAIGN_NODES.oldOrdal],
    };
    expect(buildLocationMenuBeat(oldOrdal, state).options).toEqual([]);
  });
});
