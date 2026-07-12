// Atlas — pure editing operations over the document model.
//
// Every canvas/inspector interaction routes through one of these
// (model in → new model out, no mutation) so the UI layer stays thin and
// the operations are unit-testable without a DOM. None of them validate —
// an edit may legally pass THROUGH an invalid state (delete a node, then
// fix its edges); the live validation panel reports, export gates.

import { DEFAULT_PLACEHOLDER_TEMPLATE_KEY } from '@campaign/index.ts';
import type { AtlasEdge, AtlasEngagement, AtlasGraph, AtlasNode } from './model.ts';

// The updateNode patch. Explicit `| undefined` on the OPTIONAL node fields:
// under exactOptionalPropertyTypes that is what lets a caller CLEAR one
// (patch { offset: undefined } deletes the property; the codegen omits
// absent fields, so clearing must be expressible).
export interface AtlasNodePatch {
  readonly name?: string;
  readonly chapter?: number;
  readonly engagements?: ReadonlyArray<AtlasEngagement>;
  readonly offset?: number | undefined;
  readonly isHub?: boolean | undefined;
  readonly farmable?: boolean | undefined;
  readonly x?: number;
  readonly y?: number;
}

// The default first engagement of a fresh node: a placeholder battle on the
// default template (walkable immediately).
export function defaultEngagement(): AtlasEngagement {
  return { beatsSource: { kind: 'placeholder', templateKey: DEFAULT_PLACEHOLDER_TEMPLATE_KEY } };
}

// A fresh node at a canvas position: one default engagement, no
// capabilities, the given chapter.
export function addNode(
  model: AtlasGraph,
  init: { readonly id: string; readonly name: string; readonly chapter: number; readonly x: number; readonly y: number },
): AtlasGraph {
  const node: AtlasNode = {
    id: init.id,
    name: init.name,
    chapter: init.chapter,
    engagements: [defaultEngagement()],
    x: Math.round(init.x),
    y: Math.round(init.y),
  };
  return { ...model, nodes: [...model.nodes, node] };
}

// Merge a patch into one node; `undefined` values CLEAR their field.
export function updateNode(model: AtlasGraph, id: string, patch: AtlasNodePatch): AtlasGraph {
  return {
    ...model,
    nodes: model.nodes.map((n) => {
      if (n.id !== id) return n;
      const merged: Record<string, unknown> = { ...n, ...patch };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete merged[key];
      }
      return merged as unknown as AtlasNode;
    }),
  };
}

// --- engagement-queue ops (engagement queues WI3) ---

// The updateEngagement patch; `undefined` CLEARS a field, same convention as
// AtlasNodePatch.
export interface AtlasEngagementPatch {
  readonly storyBeatId?: string | undefined;
  readonly beatsSource?: AtlasEngagement['beatsSource'];
  readonly armsAfter?: string | undefined;
}

// Every effective beat id currently in the model (explicit ids + first-
// engagement node-id defaults). Used for fresh-id generation and by the
// inspector's arming/gating pickers.
export function allBeatIds(model: AtlasGraph): ReadonlyArray<string> {
  return model.nodes.flatMap((n) =>
    n.engagements.map((e, i) => e.storyBeatId ?? (i === 0 ? n.id : '')).filter((id) => id !== ''),
  );
}

// The next unclaimed beat id for a new engagement at `nodeId`
// ('node-camp' → node-camp-2, node-camp-3, …).
export function freshBeatId(model: AtlasGraph, nodeId: string): string {
  const taken = new Set(allBeatIds(model));
  for (let i = 2; ; i += 1) {
    const candidate = `${nodeId}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function patchEngagements(
  model: AtlasGraph,
  nodeId: string,
  f: (engagements: ReadonlyArray<AtlasEngagement>) => ReadonlyArray<AtlasEngagement>,
): AtlasGraph {
  return {
    ...model,
    nodes: model.nodes.map((n) => (n.id === nodeId ? { ...n, engagements: f(n.engagements) } : n)),
  };
}

// Append an engagement to a node's queue: a default placeholder battle
// under a fresh explicit beat id (later engagements must carry one).
export function addEngagement(model: AtlasGraph, nodeId: string): AtlasGraph {
  const engagement: AtlasEngagement = { storyBeatId: freshBeatId(model, nodeId), ...defaultEngagement() };
  return patchEngagements(model, nodeId, (list) => [...list, engagement]);
}

export function removeEngagement(model: AtlasGraph, nodeId: string, index: number): AtlasGraph {
  return patchEngagements(model, nodeId, (list) => list.filter((_, i) => i !== index));
}

// Swap an engagement one step earlier/later in its queue.
export function reorderEngagement(
  model: AtlasGraph,
  nodeId: string,
  index: number,
  direction: 'up' | 'down',
): AtlasGraph {
  return patchEngagements(model, nodeId, (list) => {
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || index >= list.length || swapWith < 0 || swapWith >= list.length) return list;
    const next = [...list];
    [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
    return next;
  });
}

// Merge a patch into one engagement; `undefined` values CLEAR their field.
export function updateEngagement(
  model: AtlasGraph,
  nodeId: string,
  index: number,
  patch: AtlasEngagementPatch,
): AtlasGraph {
  return patchEngagements(model, nodeId, (list) =>
    list.map((e, i) => {
      if (i !== index) return e;
      const merged: Record<string, unknown> = { ...e, ...patch };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete merged[key];
      }
      return merged as unknown as AtlasEngagement;
    }),
  );
}

// Set or clear (undefined) a win-edge's `opensOnBeat` gate.
export function setEdgeGate(model: AtlasGraph, edge: AtlasEdge, beatId: string | undefined): AtlasGraph {
  return {
    ...model,
    edges: model.edges.map((e) => {
      if (e.from !== edge.from || e.to !== edge.to || e.on !== edge.on) return e;
      if (beatId === undefined) {
        const { opensOnBeat: _cleared, ...rest } = e;
        return rest;
      }
      return { ...e, opensOnBeat: beatId };
    }),
  };
}

// Rename a node's ID — identity, so edges and the start pointer remap too.
// When the node's FIRST engagement has no explicit storyBeatId, its
// effective beat id IS the node id — so every `armsAfter`/`opensOnBeat`
// reference to it remaps along (a rename must not silently dangle the
// arming/gating graph; node-content keyed on the old id still surfaces as
// `content-missing`, same as before).
export function renameNodeId(model: AtlasGraph, oldId: string, newId: string): AtlasGraph {
  const renamed = model.nodes.find((n) => n.id === oldId);
  const beatIdMoves = renamed !== undefined && renamed.engagements[0]?.storyBeatId === undefined;
  const remapBeat = (id: string | undefined): string | undefined =>
    beatIdMoves && id === oldId ? newId : id;
  return {
    startId: model.startId === oldId ? newId : model.startId,
    nodes: model.nodes.map((n) => {
      const node = n.id === oldId ? { ...n, id: newId } : n;
      if (!beatIdMoves) return node;
      return {
        ...node,
        engagements: node.engagements.map((e) =>
          e.armsAfter !== undefined && remapBeat(e.armsAfter) !== e.armsAfter
            ? { ...e, armsAfter: remapBeat(e.armsAfter)! }
            : e,
        ),
      };
    }),
    edges: model.edges.map((e) => ({
      ...e,
      from: e.from === oldId ? newId : e.from,
      to: e.to === oldId ? newId : e.to,
      ...(e.opensOnBeat !== undefined && remapBeat(e.opensOnBeat) !== e.opensOnBeat
        ? { opensOnBeat: remapBeat(e.opensOnBeat)! }
        : {}),
    })),
  };
}

// Remove a node and every edge touching it. A deleted START is left
// dangling on purpose — validation reports it and export stays gated until
// the author picks a new start (no silent re-pointing).
export function deleteNode(model: AtlasGraph, id: string): AtlasGraph {
  return {
    ...model,
    nodes: model.nodes.filter((n) => n.id !== id),
    edges: model.edges.filter((e) => e.from !== id && e.to !== id),
  };
}

export function moveNode(model: AtlasGraph, id: string, x: number, y: number): AtlasGraph {
  return updateNode(model, id, { x: Math.round(x), y: Math.round(y) });
}

export function setStart(model: AtlasGraph, id: string): AtlasGraph {
  return { ...model, startId: id };
}

// Append a win-edge (the end of the array is the end of the choice order).
// Duplicate edges are a no-op rather than a finding — nothing sensible to
// author twice.
export function addEdge(model: AtlasGraph, from: string, to: string): AtlasGraph {
  if (model.edges.some((e) => e.from === from && e.to === to && e.on === 'win')) return model;
  return { ...model, edges: [...model.edges, { from, to, on: 'win' }] };
}

export function deleteEdge(model: AtlasGraph, edge: AtlasEdge): AtlasGraph {
  const idx = model.edges.findIndex((e) => e.from === edge.from && e.to === edge.to && e.on === edge.on);
  if (idx === -1) return model;
  return { ...model, edges: model.edges.filter((_, i) => i !== idx) };
}

// Move a win-edge one step earlier/later WITHIN its from-node's choice
// order (edge order is the on-map choice order — brief WI3). Other nodes'
// edges keep their global positions.
export function reorderEdge(model: AtlasGraph, edge: AtlasEdge, direction: 'up' | 'down'): AtlasGraph {
  const groupIdxs = model.edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.from === edge.from && e.on === 'win')
    .map(({ i }) => i);
  const at = groupIdxs.findIndex((i) => {
    const e = model.edges[i]!;
    return e.to === edge.to && e.on === edge.on;
  });
  if (at === -1) return model;
  const swapWith = direction === 'up' ? at - 1 : at + 1;
  if (swapWith < 0 || swapWith >= groupIdxs.length) return model;
  const edges = [...model.edges];
  const a = groupIdxs[at]!;
  const b = groupIdxs[swapWith]!;
  [edges[a], edges[b]] = [edges[b]!, edges[a]!];
  return { ...model, edges };
}

// The next unclaimed 'node-<slug>' id for a display name ('Fort Rain' →
// node-fort-rain, node-fort-rain-2, …).
export function freshNodeId(model: AtlasGraph, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = `node-${slug === '' ? 'unnamed' : slug}`;
  const taken = new Set(model.nodes.map((n) => n.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
