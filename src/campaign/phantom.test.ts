// Ch1 substrate (WI3) — phantom node/edge runtime semantics: a phantom
// destination is drawn, never traversable. The routing helpers ignore
// phantom edges; the frontier never opens one; travelChoices never
// offers the phantom node. (Atlas-side validation/codegen coverage
// lives in src/app/atlas/phantom.test.ts.)

import { describe, expect, it } from 'vitest';
import { isTerminal, isWinChoice, winChoices, type CampaignGraph } from './graph.ts';
import { isEdgeOpen, travelChoices } from './travel.ts';
import { newCampaign } from './loop.ts';
import { m0Roster } from './roster.ts';
import { placeholderBattleBeat } from './placeholder-beat.ts';

// Old Ordal (real, cleared) → Viura (phantom) + a real onward road home.
const GRAPH: CampaignGraph = {
  startId: 'node-old-ordal',
  nodes: [
    {
      id: 'node-old-ordal',
      name: 'Old Ordal',
      chapter: 1,
      engagements: [{ beats: [placeholderBattleBeat('river_ridge')] }],
    },
    {
      id: 'node-home',
      name: 'Home',
      chapter: 1,
      engagements: [{ beats: [placeholderBattleBeat('stonebridge')] }],
    },
    { id: 'node-viura', name: 'Viura', chapter: 1, engagements: [], phantom: true },
  ],
  edges: [
    { from: 'node-old-ordal', to: 'node-home', on: 'win' },
    { from: 'node-old-ordal', to: 'node-viura', on: 'win', phantom: true },
  ],
};

// The party sits at cleared Old Ordal — the moment its win-edges open.
const cleared = {
  ...newCampaign(m0Roster, 'node-old-ordal'),
  clearedStoryBeats: ['node-old-ordal'],
  phase: 'awaiting_route' as const,
};

describe('phantom edge — routing helpers', () => {
  it('winChoices skips the phantom edge', () => {
    expect(winChoices(GRAPH, 'node-old-ordal').map((n) => n.id)).toEqual(['node-home']);
  });

  it('isWinChoice refuses routing to the phantom target', () => {
    expect(isWinChoice(GRAPH, 'node-old-ordal', 'node-viura')).toBe(false);
    expect(isWinChoice(GRAPH, 'node-old-ordal', 'node-home')).toBe(true);
  });

  it('a node whose only out-edge is phantom is terminal', () => {
    const graph: CampaignGraph = {
      ...GRAPH,
      edges: [{ from: 'node-old-ordal', to: 'node-viura', on: 'win', phantom: true }],
    };
    expect(isTerminal(graph, 'node-old-ordal')).toBe(true);
  });
});

describe('phantom edge — frontier', () => {
  it('never opens, even when the source is cleared', () => {
    const phantomEdge = GRAPH.edges[1]!;
    const realEdge = GRAPH.edges[0]!;
    expect(isEdgeOpen(cleared, GRAPH, realEdge)).toBe(true);
    expect(isEdgeOpen(cleared, GRAPH, phantomEdge)).toBe(false);
  });

  it('travelChoices offers the real target, never the phantom', () => {
    const ids = travelChoices(GRAPH, cleared).map((c) => c.id);
    expect(ids).toContain('node-home');
    expect(ids).not.toContain('node-viura');
  });
});
