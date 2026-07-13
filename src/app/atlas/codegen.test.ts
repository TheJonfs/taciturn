// Atlas round-trip pin — THE correctness test of the structural tier.
//
// import CAMPAIGN_GRAPH → editor model → codegen → BYTE-IDENTICAL to the
// checked-in node.ts and node-layout.ts. If this fails, the exporter is
// lossy (the brief's primary correctness failure): either the emitted shape
// changed (regenerate the shipped files in the same change) or an authored
// detail doesn't survive the model (fix the model). The hand-authored
// content behind contentBeats(id) is untouched by construction — the
// exporter emits references, never content.

import { describe, expect, it } from 'vitest';
import { CAMPAIGN_GRAPH } from '@campaign/index.ts';
import { NODE_LAYOUT } from '../interstitial/node-layout.ts';
import nodeModuleSource from '@campaign/node.ts?raw';
import layoutModuleSource from '../interstitial/node-layout.ts?raw';
import { fromCampaignGraph } from './import.ts';
import { generateLayoutModule, generateNodeModule, nodeKey } from './codegen.ts';
import { toCampaignGraph, toNodeLayout, type AtlasGraph } from './model.ts';

describe('atlas round-trip (shipped M1 graph)', () => {
  const model = fromCampaignGraph(CAMPAIGN_GRAPH, NODE_LAYOUT);

  it('codegen reproduces the checked-in node.ts byte-identically', () => {
    expect(generateNodeModule(model)).toBe(nodeModuleSource);
  });

  it('codegen reproduces the checked-in node-layout.ts byte-identically', () => {
    expect(generateLayoutModule(model)).toBe(layoutModuleSource);
  });

  it('the model resolves back to the shipped runtime graph, value-identically', () => {
    const roundTripped = toCampaignGraph(model);
    // Deep-equal covers structure; each engagement's beats array must
    // additionally be the SAME reference (content merged by beat id, never
    // copied or rebuilt).
    expect(roundTripped).toEqual(CAMPAIGN_GRAPH);
    roundTripped.nodes.forEach((n, i) => {
      n.engagements.forEach((e, j) => {
        expect(e.beats).toBe(CAMPAIGN_GRAPH.nodes[i]!.engagements[j]!.beats);
      });
    });
    expect(toNodeLayout(model)).toEqual(NODE_LAYOUT);
  });
});

describe('atlas round-trip (a synthetic camp with a queue, gates, and a stub scene)', () => {
  // The engagement-queues shapes the shipped graph doesn't exercise yet:
  // a 2-engagement camp (scene placeholders, cross-node armsAfter) and
  // per-beat gated edges. The pin here is model → runtime → model identity
  // plus the emitted text's load-bearing lines.
  const camp: AtlasGraph = {
    startId: 'node-start',
    nodes: [
      {
        id: 'node-start',
        name: 'Start',
        chapter: 1,
        engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } }],
        x: 0,
        y: 0,
      },
      {
        id: 'node-camp',
        name: 'Camp',
        chapter: 1,
        engagements: [
          { beatsSource: { kind: 'placeholder-scene', marker: 'Scene: the company arrives' } },
          {
            storyBeatId: 'camp-return',
            beatsSource: { kind: 'placeholder-scene', marker: 'Scene: the road home' },
            armsAfter: 'node-mission',
          },
        ],
        isHub: true,
        x: 120,
        y: 80,
      },
      {
        id: 'node-mission',
        name: 'Mission',
        chapter: 1,
        engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } }],
        x: 240,
        y: 0,
      },
    ],
    edges: [
      { from: 'node-start', to: 'node-camp', on: 'win' },
      { from: 'node-camp', to: 'node-mission', on: 'win', opensOnBeat: 'node-camp' },
    ],
  };

  it('resolves to a runtime graph and imports back identically', () => {
    const graph = toCampaignGraph(camp);
    const layout = toNodeLayout(camp);
    expect(fromCampaignGraph(graph, layout)).toEqual(camp);
  });

  it('emits the queue, the gate, and the stub-scene import', () => {
    const text = generateNodeModule(camp);
    expect(text).toContain("import { placeholderBattleBeat, placeholderSceneBeat } from './placeholder-beat.ts';");
    expect(text).toContain("{ beats: [placeholderSceneBeat('Scene: the company arrives')] },");
    expect(text).toContain(
      "{ storyBeatId: 'camp-return', beats: [placeholderSceneBeat('Scene: the road home')], armsAfter: 'node-mission' },",
    );
    expect(text).toContain("{ from: CAMPAIGN_NODES.camp, to: CAMPAIGN_NODES.mission, on: 'win', opensOnBeat: 'node-camp' },");
  });

  it('generated text is a fixpoint: emit → resolve → import → emit is byte-stable', () => {
    const emitted = generateNodeModule(camp);
    const reImported = fromCampaignGraph(toCampaignGraph(camp), toNodeLayout(camp));
    expect(generateNodeModule(reImported)).toBe(emitted);
  });
});

describe('nodeKey derivation', () => {
  it('camelCases slugs with and without the node- prefix', () => {
    expect(nodeKey('node-river-ridge')).toBe('riverRidge');
    expect(nodeKey('node-the-return')).toBe('theReturn');
    expect(nodeKey('stonebridge')).toBe('stonebridge');
    expect(nodeKey('node-fort-77-east')).toBe('fort77East');
  });

  it('guards degenerate ids', () => {
    expect(nodeKey('node-9th-gate')).toBe('n9thGate');
    expect(() => nodeKey('node---')).toThrow(/no identifier/);
  });
});
