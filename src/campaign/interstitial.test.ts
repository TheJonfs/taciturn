// TABA campaign — interstitial beat-sequence builder tests (the pure half).

import { describe, expect, it } from 'vitest';
import type { UnitId } from '@engine/index.ts';
import { buildInterstitial, buildUnitResultLines } from './interstitial.ts';
import type { BattleResult, UnitBattleSummary } from './battle-result.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';
import { getNode } from './graph.ts';
import { m0Roster } from './roster.ts';

const GRAPH = M1_CAMPAIGN_GRAPH;
const START = getNode(GRAPH, M1_NODES.riverRidge);
const TERMINAL = getNode(GRAPH, M1_NODES.theReturn);

// A battle result where the first two roster units fought (survived / downed)
// and the rest sat in reserve (absent from the result).
function resultFor(roster = m0Roster): BattleResult {
  const units = new Map<UnitId, UnitBattleSummary>();
  units.set(roster[0]!.id, { id: roster[0]!.id, outcome: 'survived', vitals: { hp: 20, mp: 5 } });
  units.set(roster[1]!.id, { id: roster[1]!.id, outcome: 'downed', vitals: { hp: 0, mp: 0 } });
  return {
    outcome: { winner: START.battle!.playerTeam, conditionIndex: 0, description: 'test' },
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

describe('buildInterstitial', () => {
  it('non-terminal win → [result-summary(win), world-map-choice] with the fork choices', () => {
    const beats = buildInterstitial({
      graph: GRAPH,
      node: START,
      roster: m0Roster,
      result: resultFor(),
      won: true,
      campaignComplete: false,
    });
    expect(beats.map((b) => b.type)).toEqual(['result-summary', 'world-map-choice']);

    const summary = beats[0]!;
    expect(summary.type).toBe('result-summary');
    if (summary.type === 'result-summary') {
      expect(summary.resolution).toBe('win');
      expect(summary.campaignComplete).toBe(false);
      expect(summary.units).toHaveLength(2);
    }

    const map = beats[1]!;
    if (map.type === 'world-map-choice') {
      expect(map.fromNodeId).toBe(START.id);
      // The start node's fork: Stonebridge + Marshmoor.
      expect(map.choices.map((c) => c.id)).toEqual([M1_NODES.stonebridge, M1_NODES.marshmoor]);
    }
  });

  it('terminal win → [result-summary(win, campaignComplete)] only (no map beat)', () => {
    const beats = buildInterstitial({
      graph: GRAPH,
      node: TERMINAL,
      roster: m0Roster,
      result: resultFor(),
      won: true,
      campaignComplete: true,
    });
    expect(beats.map((b) => b.type)).toEqual(['result-summary']);
    const summary = beats[0]!;
    if (summary.type === 'result-summary') {
      expect(summary.campaignComplete).toBe(true);
    }
  });

  it('loss → [result-summary(loss)] only (advance = retry; no routing)', () => {
    const beats = buildInterstitial({
      graph: GRAPH,
      node: START,
      roster: m0Roster,
      result: resultFor(),
      won: false,
      campaignComplete: false,
    });
    expect(beats.map((b) => b.type)).toEqual(['result-summary']);
    const summary = beats[0]!;
    if (summary.type === 'result-summary') {
      expect(summary.resolution).toBe('loss');
      expect(summary.campaignComplete).toBe(false);
    }
  });
});
