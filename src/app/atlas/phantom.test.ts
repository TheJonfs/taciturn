// Ch1 substrate (WI3) — Atlas-side phantom coverage: the `unreachable`
// exemption (without loosening the rule for real nodes), the phantom-
// coherence rules, codegen emission, and import/model round-trip of the
// new optional fields. (Runtime frontier/routing semantics live in
// src/campaign/phantom.test.ts.)

import { describe, expect, it } from 'vitest';
import type { AtlasGraph, AtlasNode } from './model.ts';
import { toCampaignGraph } from './model.ts';
import { fromCampaignGraph } from './import.ts';
import { generateNodeModule } from './codegen.ts';
import { setEdgePhantom } from './edit.ts';
import { validateAtlasGraph } from './validate.ts';

const rules = (model: AtlasGraph): string[] => validateAtlasGraph(model).map((f) => f.rule);

const alpha: AtlasNode = {
  id: 'node-alpha',
  name: 'Alpha',
  chapter: 1,
  engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } }],
  x: 100,
  y: 100,
};
const omega: AtlasNode = {
  id: 'node-omega',
  name: 'Omega',
  chapter: 1,
  engagements: [{ beatsSource: { kind: 'placeholder', templateKey: 'stonebridge' } }],
  x: 300,
  y: 100,
};
const viura: AtlasNode = {
  id: 'node-viura',
  name: 'Viura',
  chapter: 1,
  engagements: [],
  phantom: true,
  x: 300,
  y: 250,
};

// Alpha → Omega (real), Alpha → Viura (phantom). The Ch1 shape.
const model: AtlasGraph = {
  startId: 'node-alpha',
  nodes: [alpha, omega, viura],
  edges: [
    { from: 'node-alpha', to: 'node-omega', on: 'win' },
    { from: 'node-alpha', to: 'node-viura', on: 'win', phantom: true },
  ],
};

describe('validation — phantom exemptions', () => {
  it('a phantom node reached only by a phantom edge is NOT unreachable', () => {
    expect(rules(model)).toEqual([]);
  });

  it('a REAL unreachable node still fires — the exemption is per-flag, not global', () => {
    const stray: AtlasNode = { ...omega, id: 'node-stray', name: 'Stray', x: 500, y: 100 };
    const withStray: AtlasGraph = { ...model, nodes: [...model.nodes, stray] };
    const findings = validateAtlasGraph(withStray);
    expect(findings.map((f) => f.rule)).toContain('unreachable');
    expect(findings.find((f) => f.rule === 'unreachable')?.nodeId).toBe('node-stray');
  });

  it('a phantom edge cannot make its target count as reachable (masking check)', () => {
    // Viura made REAL while still only phantom-edge-connected: now it
    // must report unreachable — the phantom EDGE contributes nothing.
    const realViura: AtlasGraph = {
      ...model,
      nodes: [alpha, omega, { ...viura, phantom: undefined } as unknown as AtlasNode],
    };
    expect(rules(realViura)).toContain('unreachable');
  });

  it('a real edge into a phantom node is an error (it would become enterable)', () => {
    const badEdge: AtlasGraph = {
      ...model,
      edges: [...model.edges, { from: 'node-omega', to: 'node-viura', on: 'win' }],
    };
    expect(rules(badEdge)).toContain('phantom-target-real-edge');
  });

  it('engagements on a phantom node warn as dead content', () => {
    const withBeats: AtlasGraph = {
      ...model,
      nodes: [alpha, omega, { ...viura, engagements: alpha.engagements }],
    };
    const findings = validateAtlasGraph(withBeats);
    const warning = findings.find((f) => f.rule === 'phantom-with-engagements');
    expect(warning?.level).toBe('warning');
  });
});

describe('codegen + round-trip', () => {
  it('emits phantom: true on node and edge, only when set', () => {
    const source = generateNodeModule(model);
    expect(source).toContain('    phantom: true,'); // Viura's node line
    expect(source).toContain("on: 'win', phantom: true },"); // the phantom edge
    // The real node/edge lines stay clean of the field.
    expect(source).not.toContain("{ from: M1_NODES.alpha, to: M1_NODES.omega, on: 'win', phantom");
  });

  it('model → runtime graph → model preserves both phantom flags', () => {
    const runtime = toCampaignGraph(model);
    expect(runtime.nodes.find((n) => n.id === 'node-viura')?.phantom).toBe(true);
    expect(runtime.edges[1]?.phantom).toBe(true);
    const layout = Object.fromEntries(model.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const back = fromCampaignGraph(runtime, layout);
    expect(back).toEqual(model);
  });

  it('setEdgePhantom toggles by adding/DELETING the field (codegen emit-when-true)', () => {
    const off = setEdgePhantom(model, model.edges[1]!, false);
    expect('phantom' in off.edges[1]!).toBe(false);
    const on = setEdgePhantom(off, off.edges[1]!, true);
    expect(on.edges[1]!.phantom).toBe(true);
  });
});
