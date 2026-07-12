// Atlas pure editing ops — the behaviors the canvas/inspector lean on.

import { describe, expect, it } from 'vitest';
import type { AtlasGraph } from './model.ts';
import {
  addEdge,
  addEngagement,
  addNode,
  deleteEdge,
  deleteNode,
  freshNodeId,
  removeEngagement,
  renameNodeId,
  reorderEdge,
  reorderEngagement,
  setEdgeGate,
  updateEngagement,
  updateNode,
} from './edit.ts';

const model: AtlasGraph = {
  startId: 'node-a',
  nodes: [
    { id: 'node-a', name: 'A', chapter: 1, engagements: [], x: 0, y: 0 },
    { id: 'node-b', name: 'B', chapter: 1, engagements: [], offset: 2, x: 100, y: 0 },
    { id: 'node-c', name: 'C', chapter: 1, engagements: [], x: 200, y: 0 },
  ],
  edges: [
    { from: 'node-a', to: 'node-b', on: 'win' },
    { from: 'node-a', to: 'node-c', on: 'win' },
    { from: 'node-b', to: 'node-c', on: 'win' },
  ],
};

describe('atlas edit ops', () => {
  it('addNode appends a placeholder-battle node with rounded coordinates', () => {
    const next = addNode(model, { id: 'node-d', name: 'D', chapter: 2, x: 10.6, y: 20.2 });
    const added = next.nodes[next.nodes.length - 1]!;
    expect(added).toMatchObject({ id: 'node-d', chapter: 2, x: 11, y: 20 });
    expect(added.engagements).toEqual([{ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } }]);
  });

  it('updateNode merges patches and clears fields patched to undefined', () => {
    const patched = updateNode(model, 'node-b', { isHub: true, offset: undefined });
    const b = patched.nodes[1]!;
    expect(b.isHub).toBe(true);
    expect('offset' in b).toBe(false);
  });

  it('renameNodeId remaps edges and the start pointer', () => {
    const renamed = renameNodeId(model, 'node-a', 'node-alpha');
    expect(renamed.startId).toBe('node-alpha');
    expect(renamed.nodes[0]!.id).toBe('node-alpha');
    expect(renamed.edges.filter((e) => e.from === 'node-alpha')).toHaveLength(2);
    expect(renamed.edges.some((e) => e.from === 'node-a' || e.to === 'node-a')).toBe(false);
  });

  it('deleteNode removes the node and every touching edge, leaving a dangling start to validation', () => {
    const next = deleteNode(model, 'node-a');
    expect(next.nodes.map((n) => n.id)).toEqual(['node-b', 'node-c']);
    expect(next.edges).toEqual([{ from: 'node-b', to: 'node-c', on: 'win' }]);
    expect(next.startId).toBe('node-a'); // dangling — validation reports start-missing
  });

  it('addEdge appends win-edges and ignores duplicates', () => {
    expect(addEdge(model, 'node-a', 'node-b')).toBe(model);
    const next = addEdge(model, 'node-c', 'node-a');
    expect(next.edges[next.edges.length - 1]).toEqual({ from: 'node-c', to: 'node-a', on: 'win' });
  });

  it('deleteEdge removes exactly the named edge', () => {
    const next = deleteEdge(model, { from: 'node-a', to: 'node-c', on: 'win' });
    expect(next.edges).toHaveLength(2);
    expect(next.edges.some((e) => e.from === 'node-a' && e.to === 'node-c')).toBe(false);
  });

  it('reorderEdge swaps within one from-node choice group only', () => {
    const next = reorderEdge(model, { from: 'node-a', to: 'node-c', on: 'win' }, 'up');
    expect(next.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['node-a>node-c', 'node-a>node-b', 'node-b>node-c']);
    // Clamped at the boundary.
    expect(reorderEdge(next, { from: 'node-a', to: 'node-c', on: 'win' }, 'up')).toBe(next);
  });

  it('freshNodeId slugs the name and dodges collisions', () => {
    expect(freshNodeId(model, 'Fort Rain')).toBe('node-fort-rain');
    const withFort = addNode(model, { id: 'node-fort-rain', name: 'Fort Rain', chapter: 1, x: 0, y: 50 });
    expect(freshNodeId(withFort, 'Fort Rain!')).toBe('node-fort-rain-2');
    expect(freshNodeId(model, '—')).toBe('node-unnamed');
  });
});

describe('atlas engagement-queue ops', () => {
  const scene = { kind: 'placeholder-scene', marker: 'stub' } as const;
  const queued = updateNode(addEngagement(model, 'node-b'), 'node-b', {});
  const nodeB = (m: AtlasGraph) => m.nodes.find((n) => n.id === 'node-b')!;

  it('addEngagement appends a placeholder battle under a fresh explicit beat id', () => {
    const b = nodeB(queued);
    expect(b.engagements).toHaveLength(1);
    expect(b.engagements[0]).toMatchObject({
      storyBeatId: 'node-b-2',
      beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' },
    });
    // A second add dodges the taken id.
    expect(nodeB(addEngagement(queued, 'node-b')).engagements[1]!.storyBeatId).toBe('node-b-3');
  });

  it('updateEngagement merges and clears per the undefined convention', () => {
    const armed = updateEngagement(queued, 'node-b', 0, { armsAfter: 'node-a', beatsSource: scene });
    expect(nodeB(armed).engagements[0]).toMatchObject({ armsAfter: 'node-a', beatsSource: scene });
    const cleared = updateEngagement(armed, 'node-b', 0, { armsAfter: undefined });
    expect('armsAfter' in nodeB(cleared).engagements[0]!).toBe(false);
  });

  it('reorderEngagement swaps within the queue and clamps at the ends', () => {
    const two = addEngagement(queued, 'node-b');
    const swapped = reorderEngagement(two, 'node-b', 1, 'up');
    expect(nodeB(swapped).engagements.map((e) => e.storyBeatId)).toEqual(['node-b-3', 'node-b-2']);
    expect(nodeB(reorderEngagement(two, 'node-b', 0, 'up')).engagements).toEqual(nodeB(two).engagements);
  });

  it('removeEngagement drops exactly the indexed entry', () => {
    const two = addEngagement(queued, 'node-b');
    expect(nodeB(removeEngagement(two, 'node-b', 0)).engagements.map((e) => e.storyBeatId)).toEqual(['node-b-3']);
  });

  it('setEdgeGate sets and clears opensOnBeat', () => {
    const edge = model.edges[0]!; // a → b
    const gated = setEdgeGate(model, edge, 'node-a');
    expect(gated.edges[0]).toMatchObject({ opensOnBeat: 'node-a' });
    const ungated = setEdgeGate(gated, gated.edges[0]!, undefined);
    expect('opensOnBeat' in ungated.edges[0]!).toBe(false);
  });

  it('renameNodeId remaps armsAfter/opensOnBeat riding the default first-engagement beat id', () => {
    // node-a's default beat id is its node id; b arms after it and an edge
    // gates on it. Renaming node-a must carry both references along.
    const withRefs = setEdgeGate(
      updateEngagement(queued, 'node-b', 0, { armsAfter: 'node-a' }),
      queued.edges[2]!, // b → c
      'node-a',
    );
    const renamed = renameNodeId(withRefs, 'node-a', 'node-alpha');
    expect(nodeB(renamed).engagements[0]!.armsAfter).toBe('node-alpha');
    expect(renamed.edges.find((e) => e.from === 'node-b' && e.to === 'node-c')?.opensOnBeat).toBe('node-alpha');
    // An EXPLICIT beat id that happens to match the node id does not move.
    const explicit = updateEngagement(withRefs, 'node-a', 0, { storyBeatId: 'node-a' });
    const explicitA = {
      ...explicit,
      nodes: explicit.nodes.map((n) => (n.id === 'node-a' ? { ...n, engagements: [{ storyBeatId: 'node-a', beatsSource: scene }] } : n)),
    };
    const renamedExplicit = renameNodeId(explicitA, 'node-a', 'node-alpha');
    expect(nodeB(renamedExplicit).engagements[0]!.armsAfter).toBe('node-a');
  });
});
