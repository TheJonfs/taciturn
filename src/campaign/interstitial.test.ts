// TABA campaign — presentational interstitial builder tests (the pure half).

import { describe, expect, it } from 'vitest';
import type { UnitId } from '@engine/index.ts';
import {
  buildResultSummaryBeat,
  buildRouteChoice,
  buildRouteChoiceBeat,
  buildUnitResultLines,
} from './interstitial.ts';
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
  units.set(roster[0]!.id, {
    id: roster[0]!.id,
    outcome: 'survived',
    vitals: { hp: 20, mp: 5 },
    earnedJp: 0,
  });
  units.set(roster[1]!.id, {
    id: roster[1]!.id,
    outcome: 'downed',
    vitals: { hp: 0, mp: 0 },
    earnedJp: 0,
  });
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
    });
    expect(beat.type).toBe('result-summary');
    expect(beat.resolution).toBe('win');
    expect(beat.campaignComplete).toBe(false);
    expect(beat.units).toHaveLength(2);
    expect(beat.nodeName).toBe(START.name);
  });

  it('terminal win → campaignComplete flag set (the victory screen)', () => {
    const beat = buildResultSummaryBeat({
      node: getNode(GRAPH, M1_NODES.theReturn),
      roster: m0Roster,
      result: resultFor(),
      won: true,
      campaignComplete: true,
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
    });
    expect(beat.resolution).toBe('loss');
    expect(beat.campaignComplete).toBe(false);
  });
});

describe('buildRouteChoiceBeat / buildRouteChoice', () => {
  it('builds a world-map-choice with the cleared node’s win-edge choices', () => {
    const beat = buildRouteChoiceBeat(GRAPH, M1_NODES.riverRidge);
    expect(beat.type).toBe('world-map-choice');
    expect(beat.fromNodeId).toBe(M1_NODES.riverRidge);
    // The start node's fork: Stonebridge + Marshmoor.
    expect(beat.choices.map((c) => c.id)).toEqual([M1_NODES.stonebridge, M1_NODES.marshmoor]);
  });

  it('buildRouteChoice wraps it as a single-beat run (resume into awaiting_route)', () => {
    const beats = buildRouteChoice(GRAPH, M1_NODES.riverRidge);
    expect(beats.map((b) => b.type)).toEqual(['world-map-choice']);
  });
});
