// Atlas round-trip pin — THE correctness test of the structural tier.
//
// import M1_CAMPAIGN_GRAPH → editor model → codegen → BYTE-IDENTICAL to the
// checked-in node.ts and node-layout.ts. If this fails, the exporter is
// lossy (the brief's primary correctness failure): either the emitted shape
// changed (regenerate the shipped files in the same change) or an authored
// detail doesn't survive the model (fix the model). The hand-authored
// content behind contentBeats(id) is untouched by construction — the
// exporter emits references, never content.

import { describe, expect, it } from 'vitest';
import { M1_CAMPAIGN_GRAPH } from '@campaign/index.ts';
import { NODE_LAYOUT } from '../interstitial/node-layout.ts';
import nodeModuleSource from '@campaign/node.ts?raw';
import layoutModuleSource from '../interstitial/node-layout.ts?raw';
import { fromCampaignGraph } from './import.ts';
import { generateLayoutModule, generateNodeModule, nodeKey } from './codegen.ts';
import { toCampaignGraph, toNodeLayout } from './model.ts';

describe('atlas round-trip (shipped M1 graph)', () => {
  const model = fromCampaignGraph(M1_CAMPAIGN_GRAPH, NODE_LAYOUT);

  it('codegen reproduces the checked-in node.ts byte-identically', () => {
    expect(generateNodeModule(model)).toBe(nodeModuleSource);
  });

  it('codegen reproduces the checked-in node-layout.ts byte-identically', () => {
    expect(generateLayoutModule(model)).toBe(layoutModuleSource);
  });

  it('the model resolves back to the shipped runtime graph, value-identically', () => {
    const roundTripped = toCampaignGraph(model);
    // Deep-equal covers structure; the beats arrays must additionally be the
    // SAME references (content merged by id, never copied or rebuilt).
    expect(roundTripped).toEqual(M1_CAMPAIGN_GRAPH);
    roundTripped.nodes.forEach((n, i) => {
      expect(n.beats).toBe(M1_CAMPAIGN_GRAPH.nodes[i]!.beats);
    });
    expect(toNodeLayout(model)).toEqual(NODE_LAYOUT);
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
