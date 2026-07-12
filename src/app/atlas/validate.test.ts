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
    { id: 'node-alpha', name: 'Alpha', chapter: 1, engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } }], x: 100, y: 100 },
    { id: 'node-omega', name: 'Omega', chapter: 2, engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'stonebridge' } }], x: 300, y: 100 },
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
    const model = skeleton({
      nodes: [a!, { ...b!, engagements: [{ storyBeatId: 'node-alpha', beatsSource: { kind: 'placeholder', templateKey: 'stonebridge' } }] }],
    });
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
    expect(rules(skeleton({ nodes: [a!, { ...b!, engagements: [{ beatsSource: { kind: 'content' } }] }] }))).toContain('content-missing');
  });

  it('accepts a content claim for a real node-content id', () => {
    const [a] = skeleton().nodes;
    const model = skeleton({
      nodes: [
        a!,
        { id: 'node-marshmoor', name: 'Marshmoor', chapter: 1, engagements: [{ beatsSource: { kind: 'content' } }], x: 300, y: 100 },
      ],
      edges: [{ from: 'node-alpha', to: 'node-marshmoor', on: 'win' }],
    });
    expect(rules(model)).toEqual([]);
  });

  it('catches an unregistered placeholder template', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'atlantis' } }] }] });
    expect(rules(model)).toContain('template-unknown');
  });

  it('catches farmable with no battle beat', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [a!, { ...b!, engagements: [], farmable: true }] });
    expect(rules(model)).toContain('farmable-no-battle');
  });

  it('warns (not errors) on a battle-less start node', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({ nodes: [{ ...a!, engagements: [] }, b!] });
    const findings = validateAtlasGraph(model);
    const startFinding = findings.find((f) => f.rule === 'start-no-battle');
    expect(startFinding?.level).toBe('warning');
  });

  it('a pure market town (isHub, no beats) mid-road validates clean', () => {
    const [a, b] = skeleton().nodes;
    const model = skeleton({
      nodes: [a!, { id: 'node-town', name: 'Town', chapter: 1, engagements: [], isHub: true, x: 200, y: 200 }, b!],
      edges: [
        { from: 'node-alpha', to: 'node-town', on: 'win' },
        { from: 'node-town', to: 'node-omega', on: 'win' },
      ],
    });
    expect(rules(model)).toEqual([]);
  });
});

describe('validateAtlasGraph — engagement queues + per-beat gating', () => {
  const scene = { kind: 'placeholder-scene', marker: 'stub' } as const;
  const battle = { kind: 'placeholder', templateKey: 'river_ridge' } as const;

  // The acceptance camp: A opens the road to mission X; B arms after
  // mission X and opens the road to the finale.
  function campModel(): AtlasGraph {
    return {
      startId: 'node-start',
      nodes: [
        { id: 'node-start', name: 'Start', chapter: 1, engagements: [{ beatsSource: battle }], x: 0, y: 0 },
        {
          id: 'node-camp',
          name: 'Camp',
          chapter: 1,
          engagements: [
            { beatsSource: scene },
            { storyBeatId: 'camp-return', beatsSource: scene, armsAfter: 'node-mission-x' },
          ],
          isHub: true,
          x: 100,
          y: 100,
        },
        { id: 'node-mission-x', name: 'Mission X', chapter: 1, engagements: [{ beatsSource: battle }], x: 200, y: 0 },
        { id: 'node-finale', name: 'Finale', chapter: 1, engagements: [{ beatsSource: battle }], x: 300, y: 100 },
      ],
      edges: [
        { from: 'node-start', to: 'node-camp', on: 'win' },
        { from: 'node-camp', to: 'node-mission-x', on: 'win', opensOnBeat: 'node-camp' },
        { from: 'node-camp', to: 'node-finale', on: 'win', opensOnBeat: 'camp-return' },
      ],
    };
  }

  it('the valid camp shape passes clean (no false positives)', () => {
    expect(rules(campModel())).toEqual([]);
  });

  it('catches a later engagement with no explicit beat id', () => {
    const model = campModel();
    const camp = model.nodes[1]!;
    const broken = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-camp'
          ? { ...camp, engagements: [camp.engagements[0]!, { beatsSource: scene }] }
          : n,
      ),
    };
    expect(rules(broken)).toContain('engagement-id-missing');
  });

  it('catches beat-id collisions across engagements of different nodes', () => {
    const model = campModel();
    const broken = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-mission-x'
          ? { ...n, engagements: [{ storyBeatId: 'camp-return', beatsSource: battle }] }
          : n,
      ),
    };
    expect(rules(broken)).toContain('story-beat-id-collision');
  });

  it('catches dangling arms-after and opens-on references', () => {
    const model = campModel();
    const badArm = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-camp'
          ? {
              ...n,
              engagements: [
                n.engagements[0]!,
                { ...n.engagements[1]!, armsAfter: 'node-ghost' },
              ],
            }
          : n,
      ),
    };
    expect(rules(badArm)).toContain('arms-after-unknown');
    const badGate = {
      ...model,
      edges: model.edges.map((e) => (e.to === 'node-finale' ? { ...e, opensOnBeat: 'beat-ghost' } : e)),
    };
    expect(rules(badGate)).toContain('opens-on-unknown');
  });

  it('catches an arming cycle as never-arming engagements', () => {
    const model = campModel();
    const camp = model.nodes[1]!;
    // B arms after C; C arms after B — neither can ever arm.
    const broken = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-camp'
          ? {
              ...camp,
              engagements: [
                camp.engagements[0]!,
                { storyBeatId: 'camp-b', beatsSource: scene, armsAfter: 'camp-c' },
                { storyBeatId: 'camp-c', beatsSource: scene, armsAfter: 'camp-b' },
              ],
            }
          : n,
      ),
      // Keep the finale reachable so the only findings are the arming ones.
      edges: model.edges.map((e) => (e.to === 'node-finale' ? { ...e, opensOnBeat: 'node-camp' } : e)),
    };
    const found = rules(broken);
    expect(found.filter((r) => r === 'engagement-never-arms')).toHaveLength(2);
    expect(found).not.toContain('unreachable-under-gating');
  });

  it('catches a node reachable structurally but not under gating (no false negatives)', () => {
    const model = campModel();
    // Gate the finale on a beat that itself arms after clearing the finale —
    // mutually stuck: the finale is structurally reachable but never opens.
    const broken = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-camp'
          ? {
              ...n,
              engagements: [
                n.engagements[0]!,
                { ...n.engagements[1]!, armsAfter: 'node-finale' },
              ],
            }
          : n,
      ),
    };
    const found = rules(broken);
    expect(found).toContain('unreachable-under-gating');
    expect(found).toContain('engagement-never-arms');
  });

  it('warns on a placeholder scene with empty marker text', () => {
    const model = campModel();
    const broken = {
      ...model,
      nodes: model.nodes.map((n) =>
        n.id === 'node-camp'
          ? { ...n, engagements: [{ beatsSource: { kind: 'placeholder-scene', marker: '  ' } as const }, n.engagements[1]!] }
          : n,
      ),
    };
    const findings = validateAtlasGraph(broken);
    expect(findings.find((f) => f.rule === 'scene-marker-empty')?.level).toBe('warning');
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
