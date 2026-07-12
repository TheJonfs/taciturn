// Atlas pure editing ops — the behaviors the canvas/inspector lean on.

import { describe, expect, it } from 'vitest';
import type { AtlasGraph } from './model.ts';
import {
  addEdge,
  addNode,
  deleteEdge,
  deleteNode,
  freshNodeId,
  renameNodeId,
  reorderEdge,
  updateNode,
} from './edit.ts';

const model: AtlasGraph = {
  startId: 'node-a',
  nodes: [
    { id: 'node-a', name: 'A', chapter: 1, beatsSource: { kind: 'none' }, x: 0, y: 0 },
    { id: 'node-b', name: 'B', chapter: 1, beatsSource: { kind: 'none' }, offset: 2, x: 100, y: 0 },
    { id: 'node-c', name: 'C', chapter: 1, beatsSource: { kind: 'none' }, x: 200, y: 0 },
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
    expect(added.beatsSource).toEqual({ kind: 'placeholder', templateKey: 'river_ridge' });
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
