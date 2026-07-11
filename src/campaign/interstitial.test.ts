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
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { getNode } from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import { m0Roster } from './roster.ts';

const GRAPH = M1_CAMPAIGN_GRAPH;
const START = getNode(GRAPH, M1_NODES.riverRidge);
const START_TEAM = firstBattleBeat(START.beats)!.battle.playerTeam;

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
      node: getNode(GRAPH, M1_NODES.theReturn),
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
  // A campaign that just cleared the start node (the fork).
  const clearedStart = {
    ...newCampaign(m0Roster, M1_NODES.riverRidge),
    clearedStoryBeats: [M1_NODES.riverRidge],
    gil: 340,
  };

  it('builds a world-map-choice from the travel model (frontier + returnables)', () => {
    const beat = buildRouteChoiceBeat(GRAPH, clearedStart);
    expect(beat.type).toBe('world-map-choice');
    expect(beat.fromNodeId).toBe(M1_NODES.riverRidge);
    // The start node's fork (frontier, authored order)… plus the cleared
    // farmable start itself as a returnable (M3 economy Stage 1).
    expect(beat.choices.map((c) => c.id)).toEqual([
      M1_NODES.stonebridge,
      M1_NODES.marshmoor,
      M1_NODES.riverRidge,
    ]);
    expect(beat.choices.map((c) => c.kind)).toEqual(['advance', 'advance', 'revisit']);
    // The purse snapshot rides the beat (M3 economy Stage 0).
    expect(beat.gil).toBe(340);
  });

  it('buildRouteChoice wraps it as a single-beat run (resume into awaiting_route)', () => {
    const beats = buildRouteChoice(GRAPH, clearedStart);
    expect(beats.map((b) => b.type)).toEqual(['world-map-choice']);
  });
});

describe('buildLocationMenuBeat', () => {
  it('offers a skirmish (with the resolved level) at a cleared farmable node', () => {
    const state = {
      ...newCampaign(m0Roster, M1_NODES.riverRidge),
      clearedStoryBeats: [M1_NODES.riverRidge],
      gil: 75,
    };
    const beat = buildLocationMenuBeat(START, state);
    expect(beat.type).toBe('location-menu');
    expect(beat.nodeId).toBe(M1_NODES.riverRidge);
    expect(beat.gil).toBe(75);
    expect(beat.options.map((o) => o.action)).toEqual(['skirmish']);
    // The detail names the resolved enemy level (party avg + offset).
    expect(beat.options[0]!.detail).toMatch(/enemy level/i);
  });

  it('offers the armed story AND the shop at an uncleared hub (Dorter coexistence)', () => {
    const stonebridge = getNode(GRAPH, M1_NODES.stonebridge);
    const state = {
      ...newCampaign(m0Roster, M1_NODES.stonebridge),
      visited: [M1_NODES.riverRidge, M1_NODES.stonebridge],
      clearedStoryBeats: [M1_NODES.riverRidge],
    };
    const beat = buildLocationMenuBeat(stonebridge, state);
    expect(beat.options.map((o) => o.action)).toEqual(['story', 'shop']);
  });

  it('offers skirmish AND shop at a cleared hub (the valve + commerce coexist)', () => {
    const stonebridge = getNode(GRAPH, M1_NODES.stonebridge);
    const state = {
      ...newCampaign(m0Roster, M1_NODES.stonebridge),
      visited: [M1_NODES.riverRidge, M1_NODES.stonebridge],
      clearedStoryBeats: [M1_NODES.riverRidge, M1_NODES.stonebridge],
    };
    const beat = buildLocationMenuBeat(stonebridge, state);
    expect(beat.options.map((o) => o.action)).toEqual(['skirmish', 'shop']);
  });

  it('offers nothing at a cleared node with no open capabilities', () => {
    // The Crossing: story-only, never farmable/hub.
    const crossing = getNode(GRAPH, M1_NODES.theCrossing);
    const state = {
      ...newCampaign(m0Roster, M1_NODES.theCrossing),
      clearedStoryBeats: [M1_NODES.theCrossing],
    };
    expect(buildLocationMenuBeat(crossing, state).options).toEqual([]);
  });
});
