// Atlas — the graph editor's document model (node-authoring structural tier).
//
// An `AtlasGraph` is the editable, JSON-serializable form of the campaign
// SKELETON: topology, chapters, capabilities, layout, and each node's beats
// SOURCE — never the beats themselves. Hand-authored content (scenes, real
// battle beats, enemy derivation in node-content.ts) is referenced by id and
// deliberately unrepresentable here: the tool cannot express it, so the tool
// cannot lose it. The model round-trips with the shipped modules through
// import.ts (shipped → model) and codegen.ts (model → shipped), and resolves
// to a real runtime `CampaignGraph` via `toCampaignGraph` for live preview
// and walkability checks.
//
// Node and edge ARRAY ORDER is authored data: node order is codegen order,
// edge order is the world map's choice order.

import type { CampaignGraph, CampaignNode } from '@campaign/index.ts';
import { contentBeats, placeholderBattleBeat } from '@campaign/index.ts';

// Where a node's beats come from.
//   'content'     — hand-authored in node-content.ts under this node's id.
//   'placeholder' — a stand-in battle on a registered template (walkable now,
//                   replaced by real content in the detail tier).
//   'none'        — no beats at all (a pure market town / empty waypoint;
//                   visit-completes semantics).
export type AtlasBeatsSource =
  | { readonly kind: 'content' }
  | { readonly kind: 'placeholder'; readonly templateKey: string }
  | { readonly kind: 'none' };

export interface AtlasNode {
  readonly id: string;
  readonly name: string;
  readonly chapter: number;
  readonly beatsSource: AtlasBeatsSource;
  readonly storyBeatId?: string;
  readonly offset?: number;
  readonly isHub?: boolean;
  readonly farmable?: boolean;
  // Layout (world-map viewBox units) — the node-layout.ts slice.
  readonly x: number;
  readonly y: number;
}

export interface AtlasEdge {
  readonly from: string;
  readonly to: string;
  readonly on: 'win' | 'loss';
}

export interface AtlasGraph {
  readonly startId: string;
  readonly nodes: ReadonlyArray<AtlasNode>;
  readonly edges: ReadonlyArray<AtlasEdge>;
}

// Resolve a model node's beats. Loud-fail by construction: 'content' throws
// on a missing node-content entry, 'placeholder' on an unknown template key.
export function resolveBeats(node: AtlasNode): CampaignNode['beats'] {
  switch (node.beatsSource.kind) {
    case 'content':
      return contentBeats(node.id);
    case 'placeholder':
      return [placeholderBattleBeat(node.beatsSource.templateKey)];
    case 'none':
      return [];
  }
}

// The model as a real runtime graph — what the live preview renders and the
// walkability checks exercise. Exactly the value the generated node.ts would
// produce (same beats resolution), minus the codegen text in between.
export function toCampaignGraph(model: AtlasGraph): CampaignGraph {
  return {
    startId: model.startId,
    nodes: model.nodes.map((n): CampaignNode => ({
      id: n.id,
      name: n.name,
      chapter: n.chapter,
      beats: resolveBeats(n),
      ...(n.storyBeatId !== undefined ? { storyBeatId: n.storyBeatId } : {}),
      ...(n.offset !== undefined ? { offset: n.offset } : {}),
      ...(n.isHub !== undefined ? { isHub: n.isHub } : {}),
      ...(n.farmable !== undefined ? { farmable: n.farmable } : {}),
    })),
    edges: model.edges.map((e) => ({ from: e.from, to: e.to, on: e.on })),
  };
}

// The model's layout slice — what the world map (and its march) read.
export function toNodeLayout(model: AtlasGraph): Readonly<Record<string, { x: number; y: number }>> {
  return Object.fromEntries(model.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
}
