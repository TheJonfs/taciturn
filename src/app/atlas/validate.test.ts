// Atlas validation — each invariant violation is caught (acceptance
// criterion), including the new chapter-monotonicity-along-edges rule.
// Baseline: the shipped M1 graph validates clean.

import { describe, expect, it } from 'vitest';
import { M1_CAMPAIGN_GRAPH } from '@campaign/index.ts';
import { NODE_LAYOUT } from '../interstitial/node-layout.ts';
import { fromCampaignGraph } from './import.ts';
import type { AtlasGraph, AtlasNode } from './model.ts';
import { validateAtlasGraph } from './validate.ts';

const rules = (model: AtlasGraph): string[] => validateAtlasGraph(model).map((f) => f.rule);

// A minimal well-formed two-node skeleton to break in targeted ways.
function skeleton(overrides?: {
  nodes?: ReadonlyArray<AtlasNode>;
  edges?: AtlasGraph['edges'];
  startId?: string;
}): AtlasGraph {
  const nodes: ReadonlyArray<AtlasNode> = overrides?.nodes ?? [
    { id: 'node-alpha', name: 'Alpha', chapter: 1, beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' }, x: 100, y: 100 },
    { id: 'node-omega', name: 'Omega', chapter: 2, beatsSource: { kind: 'placeholder', templateKey: 'stonebridge' }, x: 300, y: 100 },
  ];
  return {
    startId: overrides?.startId ?? 'node-alpha',
    nodes,
    edges: overrides?.edges ?? [{ from: 'node-alpha', to: 'node-omega', on: 'win' }],
  };
}

describe('validateAtlasGraph — baseline', () => {
  it('the shipped M1 graph validates with no findings', () => {
    expect(validateAtlasGraph(fromCampaignGraph(M1_CAMPAIGN_GRAPH, NODE_LAYOUT))).toEqual([]);
  });

  it('a fresh placeholder skeleton validates with no findings', () => {
    expect(validateAtlasGraph(skeleton())).toEqual([]);
  });
});

describe('validateAtlasGraph — ids', () => {
  it('catches duplicate ids', () => {
    const [a, b] = skeleton().nodes;
    expect(rules(skeleton({ nodes: [a!, { ...b!, id: 'node-alpha' }] }))).toContain('id-duplicate');
  });

  it('catches empty ids and ids with no codegen identifier', () => {
    const [a, b] = skeleton().nodes;
    expect(rules(skeleton({ nodes: [a!, { ...b!, id: '' }], startId: 'node-alpha' }))).toContain('id-empty');
    expect(rules(skeleton({ nodes: [a!, { ...b!, id: 'node---' }] }))).toContain('id-no-key');
  });

  it('catches distinct ids that collide on the codegen key', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({
      nodes: [a!, { ...b!, id: 'node-alpha!' }],
      edges: [{ from: 'node-alpha', to: 'node-alpha!', on: 'win' }],
    });
    expect(rules(model)).toContain('id-key-collision');
  });

  it('catches story-beat id collisions (explicit vs defaulted)', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, storyBeatId: 'node-alpha' }] });
    expect(rules(model)).toContain('story-beat-id-collision');
  });
});

describe('validateAtlasGraph — edges and topology', () => {
  it('catches a missing startId and dangling edges', () => {
    expect(rules(skeleton({ startId: 'node-nowhere' }))).toContain('start-missing');
    expect(rules(skeleton({ edges: [{ from: 'node-alpha', to: 'node-ghost', on: 'win' }] }))).toContain('edge-dangling');
  });

  it('catches self-loops', () => {
    const model = skeleton({
      edges: [
        { from: 'node-alpha', to: 'node-omega', on: 'win' },
        { from: 'node-omega', to: 'node-omega', on: 'win' },
      ],
    });
    expect(rules(model)).toContain('edge-self');
  });

  it('catches unreachable nodes', () => {
    expect(rules(skeleton({ edges: [] }))).toContain('unreachable');
  });

  it('catches a graph with no reachable terminal (cycle swallows the end)', () => {
    const model = skeleton({
      nodes: [
        ...skeleton().nodes.map((n) => ({ ...n, chapter: 1 })),
      ],
      edges: [
        { from: 'node-alpha', to: 'node-omega', on: 'win' },
        { from: 'node-omega', to: 'node-alpha', on: 'win' },
      ],
    });
    const found = rules(model);
    expect(found).toContain('no-terminal');
    expect(found).toContain('cycle');
  });

  it('catches chapter regression along a win-edge, and only win-edges', () => {
    const [a, b] = skeleton().nodes;
    const swapped = skeleton({ nodes: [{ ...a!, chapter: 3 }, b!] });
    expect(rules(swapped)).toContain('chapter-regression');
    // The same regression on a LOSS edge is fine (loss-routing may retreat).
    const lossOnly = skeleton({
      nodes: [{ ...a!, chapter: 3 }, b!],
      edges: [
        { from: 'node-alpha', to: 'node-omega', on: 'loss' },
        { from: 'node-alpha', to: 'node-omega', on: 'win' },
      ],
    });
    expect(rules(lossOnly)).toContain('chapter-regression'); // the win-edge still regresses
    const winForward = skeleton({
      nodes: [{ ...a!, chapter: 2 }, { ...b!, chapter: 2 }],
    });
    expect(rules(winForward)).toEqual([]); // equal chapters are non-decreasing
  });
});

describe('validateAtlasGraph — node rules', () => {
  it('catches empty names and invalid chapters', () => {
    const [a, b] = skeleton().nodes;
    expect(rules(skeleton({ nodes: [a!, { ...b!, name: ' ' }] }))).toContain('name-empty');
    expect(rules(skeleton({ nodes: [a!, { ...b!, chapter: 0 }] }))).toContain('chapter-invalid');
    expect(rules(skeleton({ nodes: [a!, { ...b!, chapter: 1.5 }] }))).toContain('chapter-invalid');
  });

  it('catches a content claim with no node-content entry', () => {
    const [a, b] = skeleton().nodes;
    expect(rules(skeleton({ nodes: [a!, { ...b!, beatsSource: { kind: 'content' } }] }))).toContain('content-missing');
  });

  it('accepts a content claim for a real node-content id', () => {
    const [a] = skeleton().nodes;
    const model = skeleton({
      nodes: [
        a!,
        { id: 'node-marshmoor', name: 'Marshmoor', chapter: 1, beatsSource: { kind: 'content' }, x: 300, y: 100 },
      ],
      edges: [{ from: 'node-alpha', to: 'node-marshmoor', on: 'win' }],
    });
    expect(rules(model)).toEqual([]);
  });

  it('catches an unregistered placeholder template', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, beatsSource: { kind: 'placeholder', templateKey: 'atlantis' } }] });
    expect(rules(model)).toContain('template-unknown');
  });

  it('catches farmable with no battle beat', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, beatsSource: { kind: 'none' }, farmable: true }] });
    expect(rules(model)).toContain('farmable-no-battle');
  });

  it('warns (not errors) on a battle-less start node', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [{ ...a!, beatsSource: { kind: 'none' } }, b!] });
    const findings = validateAtlasGraph(model);
    const startFinding = findings.find((f) => f.rule === 'start-no-battle');
    expect(startFinding?.level).toBe('warning');
  });

  it('a pure market town (isHub, no beats) mid-road validates clean', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({
      nodes: [a!, { id: 'node-town', name: 'Town', chapter: 1, beatsSource: { kind: 'none' }, isHub: true, x: 200, y: 200 }, b!],
      edges: [
        { from: 'node-alpha', to: 'node-town', on: 'win' },
        { from: 'node-town', to: 'node-omega', on: 'win' },
      ],
    });
    expect(rules(model)).toEqual([]);
  });
});

describe('validateAtlasGraph — layout', () => {
  it('warns when two nodes sit closer than the render minimum', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, x: a!.x + 10, y: a!.y + 10 }] });
    const findings = validateAtlasGraph(model);
    const overlap = findings.find((f) => f.rule === 'layout-overlap');
    expect(overlap?.level).toBe('warning');
  });
});
