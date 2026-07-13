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
import { CAMPAIGN_GRAPH, CAMPAIGN_NODES } from './node.ts';

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

describe('the authored Chapter 1 graph', () => {
  const g = CAMPAIGN_GRAPH;

  it('every edge points at a node that exists', () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('battle nodes carry a battle beat; the hubs Zarghidas/Zelmonia Castle and the phantom Viura are battle-less', () => {
    const battleless = new Set<string>([
      CAMPAIGN_NODES.zarghidas,
      CAMPAIGN_NODES.zelmoniaCastle,
      CAMPAIGN_NODES.viura,
    ]);
    for (const n of g.nodes) {
      if (battleless.has(n.id)) {
        expect(isStandalone(allNodeBeats(n))).toBe(true);
      } else {
        expect(firstBattleBeat(allNodeBeats(n))).toBeDefined();
      }
    }
  });

  it('the spine is linear: every non-terminal real node has exactly one real win-choice', () => {
    for (const n of g.nodes) {
      if (n.phantom === true) continue;
      const choices = winChoices(g, n.id);
      if (n.id === CAMPAIGN_NODES.rukVillage) {
        expect(choices).toEqual([]); // the finale is terminal
      } else {
        expect(choices, `${n.id} should have one onward road`).toHaveLength(1);
      }
    }
  });

  it('walks start → finale in the authored order', () => {
    const spine: string[] = [g.startId];
    while (winChoices(g, spine[spine.length - 1]!).length > 0) {
      spine.push(winChoices(g, spine[spine.length - 1]!)[0]!.id);
    }
    expect(spine).toEqual([
      CAMPAIGN_NODES.zarghidas,
      CAMPAIGN_NODES.oskun,
      CAMPAIGN_NODES.alvera,
      CAMPAIGN_NODES.zelmoniaCastle,
      CAMPAIGN_NODES.zelmoniaHills,
      CAMPAIGN_NODES.grekForest,
      CAMPAIGN_NODES.fortCator,
      CAMPAIGN_NODES.ordalCanyon,
      CAMPAIGN_NODES.oldOrdal,
      CAMPAIGN_NODES.mountEska,
      CAMPAIGN_NODES.esterRoad,
      CAMPAIGN_NODES.rukVillage,
    ]);
  });

  it('Old Ordal keeps its REAL onward edge despite the phantom road to Viura (S92 watch-for)', () => {
    // Phantom edges are excluded from isTerminal — if the real →Mount Eska
    // edge were dropped, Old Ordal would become terminal and break the spine.
    expect(isTerminal(g, CAMPAIGN_NODES.oldOrdal)).toBe(false);
    expect(winChoices(g, CAMPAIGN_NODES.oldOrdal).map((n) => n.id)).toEqual([CAMPAIGN_NODES.mountEska]);
  });

  it('Viura is phantom: drawn, never a route', () => {
    const viura = getNode(g, CAMPAIGN_NODES.viura);
    expect(viura.phantom).toBe(true);
    const phantomEdge = g.edges.find((e) => e.to === CAMPAIGN_NODES.viura)!;
    expect(phantomEdge.phantom).toBe(true);
    expect(isWinChoice(g, CAMPAIGN_NODES.oldOrdal, CAMPAIGN_NODES.viura)).toBe(false);
  });

  it('capabilities match the brief: hubs, farmables, dead nodes, chapter tags', () => {
    const by = (id: string) => getNode(g, id);
    for (const id of [
      CAMPAIGN_NODES.zarghidas,
      CAMPAIGN_NODES.alvera,
      CAMPAIGN_NODES.zelmoniaCastle,
      CAMPAIGN_NODES.fortCator,
    ]) {
      expect(by(id).isHub, `${id} should be a hub`).toBe(true);
    }
    for (const id of [
      CAMPAIGN_NODES.oskun,
      CAMPAIGN_NODES.zelmoniaHills,
      CAMPAIGN_NODES.grekForest,
      CAMPAIGN_NODES.ordalCanyon,
      CAMPAIGN_NODES.mountEska,
      CAMPAIGN_NODES.esterRoad,
    ]) {
      expect(by(id).farmable, `${id} should be farmable`).toBe(true);
    }
    // Dead nodes: Old Ordal, and Ruk Village in Ch1 (hub in Ch2).
    for (const id of [CAMPAIGN_NODES.oldOrdal, CAMPAIGN_NODES.rukVillage]) {
      expect(by(id).isHub ?? false).toBe(false);
      expect(by(id).farmable ?? false).toBe(false);
    }
    expect(g.nodes.every((n) => n.chapter === 1)).toBe(true);
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
