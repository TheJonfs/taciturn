// TABA campaign — branching graph model + routing tests (the pure core).
//
// Exercises the routing computation against the authored M1 graph AND a tiny
// hand-built graph (so the shapes — fork, skippable side-node, terminal,
// loss-edge — are asserted in isolation, not just as they happen to appear in
// M1 content).

import { describe, expect, it } from 'vitest';
import {
  allNodeBeats,
  getNode,
  isTerminal,
  isWinChoice,
  nextNodes,
  winChoices,
  type CampaignGraph,
} from './graph.ts';
import { firstBattleBeat, isStandalone } from './sequence.ts';
import { M1_CAMPAIGN_GRAPH, M1_NODES } from './node.ts';

// A minimal graph: A forks to B (side) or C; B rejoins C; C is terminal. A
// has a loss-edge to a retry node R (exercises outcome-awareness, which M1
// content doesn't author). Nodes carry empty beat sequences — the graph
// machinery is beat-agnostic (only the driver walks the beats).
const TINY: CampaignGraph = {
  startId: 'a',
  nodes: [
    { id: 'a', name: 'A', chapter: 1, engagements: [] },
    { id: 'b', name: 'B', chapter: 1, engagements: [] },
    { id: 'c', name: 'C', chapter: 1, engagements: [] },
    { id: 'r', name: 'R', chapter: 1, engagements: [] },
  ],
  edges: [
    { from: 'a', to: 'b', on: 'win' },
    { from: 'a', to: 'c', on: 'win' },
    { from: 'a', to: 'r', on: 'loss' },
    { from: 'b', to: 'c', on: 'win' },
  ],
};

describe('graph lookups', () => {
  it('getNode resolves an id', () => {
    expect(getNode(TINY, 'b').name).toBe('B');
  });

  it('getNode throws on an unknown id', () => {
    expect(() => getNode(TINY, 'nope')).toThrow(/no node with id/);
  });
});

describe('routing', () => {
  it('winChoices returns the fork targets in authored order', () => {
    expect(winChoices(TINY, 'a').map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('a linear node has exactly one win-choice', () => {
    expect(winChoices(TINY, 'b').map((n) => n.id)).toEqual(['c']);
  });

  it('a terminal node has no win-choices', () => {
    expect(winChoices(TINY, 'c')).toEqual([]);
    expect(isTerminal(TINY, 'c')).toBe(true);
    expect(isTerminal(TINY, 'a')).toBe(false);
  });

  it('nextNodes is outcome-aware (loss-edges are separate)', () => {
    expect(nextNodes(TINY, 'a', 'loss').map((n) => n.id)).toEqual(['r']);
    // loss-edges don't leak into win-choices.
    expect(winChoices(TINY, 'a').some((n) => n.id === 'r')).toBe(false);
  });

  it('isWinChoice guards legal vs illegal routes', () => {
    expect(isWinChoice(TINY, 'a', 'b')).toBe(true);
    expect(isWinChoice(TINY, 'a', 'r')).toBe(false); // loss target, not a win-choice
    expect(isWinChoice(TINY, 'b', 'a')).toBe(false); // no such edge
  });
});

describe('the authored M1 graph', () => {
  const g = M1_CAMPAIGN_GRAPH;

  it('every edge points at a node that exists', () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('battle nodes carry a battle beat; The Crossing is a standalone story node', () => {
    for (const n of g.nodes) {
      if (n.id === M1_NODES.theCrossing) {
        expect(isStandalone(allNodeBeats(n))).toBe(true);
      } else {
        expect(firstBattleBeat(allNodeBeats(n))).toBeDefined();
      }
    }
  });

  it('the standalone story node sits on the south route (Marshmoor → Crossing → Return)', () => {
    expect(winChoices(g, M1_NODES.marshmoor).map((n) => n.id)).toEqual([M1_NODES.theCrossing]);
    expect(winChoices(g, M1_NODES.theCrossing).map((n) => n.id)).toEqual([M1_NODES.theReturn]);
  });

  it('the start node is a genuine player-choice fork (>= 2 win-choices)', () => {
    expect(winChoices(g, g.startId).length).toBeGreaterThanOrEqual(2);
  });

  it('Stonebridge offers the skippable side-node AND the rejoin (skip)', () => {
    const choices = winChoices(g, M1_NODES.stonebridge).map((n) => n.id);
    expect(choices).toContain(M1_NODES.mountainPass); // take the side-node
    expect(choices).toContain(M1_NODES.theReturn); // skip straight to the finale
  });

  it('the side-node rejoins the convergent terminal', () => {
    expect(winChoices(g, M1_NODES.mountainPass).map((n) => n.id)).toEqual([M1_NODES.theReturn]);
    expect(isTerminal(g, M1_NODES.theReturn)).toBe(true);
  });

  it('is a forward DAG (no node reaches itself by following win-edges)', () => {
    for (const start of g.nodes) {
      const seen = new Set<string>();
      const stack = [start.id];
      let reachedSelfAfterStep = false;
      let first = true;
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (!first && id === start.id) reachedSelfAfterStep = true;
        first = false;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const n of winChoices(g, id)) stack.push(n.id);
      }
      expect(reachedSelfAfterStep).toBe(false);
    }
  });
});
