// Atlas — the graph editor's document model (node-authoring structural tier;
// engagement queues + per-beat edge gating, M3).
//
// An `AtlasGraph` is the editable, JSON-serializable form of the campaign
// SKELETON: topology, chapters, capabilities, layout, and each node's
// ENGAGEMENT QUEUE — where each engagement's beats come from, never the
// beats themselves. Hand-authored content (scenes, real battle beats, enemy
// derivation in node-content.ts) is referenced by beat id and deliberately
// unrepresentable here: the tool cannot express it, so the tool cannot lose
// it. The model round-trips with the shipped modules through import.ts
// (shipped → model) and codegen.ts (model → shipped), and resolves to a real
// runtime `CampaignGraph` via `toCampaignGraph` for live preview and
// walkability checks.
//
// Node, edge, AND ENGAGEMENT array order is authored data: node order is
// codegen order, edge order is the world map's choice order, engagement
// order is the queue.

import type { CampaignGraph, CampaignNode, Engagement } from '@campaign/index.ts';
import { contentBeats, placeholderBattleBeat, placeholderSceneBeat } from '@campaign/index.ts';

// Where an engagement's beats come from.
//   'content'           — hand-authored in node-content.ts under this
//                         engagement's effective beat id.
//   'placeholder'       — a stand-in battle on a registered template
//                         (walkable now, replaced by real content later).
//   'placeholder-scene' — a stub one-line scene carrying the author's marker
//                         text (WI4 — structure-walkable before dialogue).
// A node with NO engagements is the beat-less case (a pure market town /
// empty waypoint; visit-completes semantics) — the old node-level 'none'.
export type AtlasBeatsSource =
  | { readonly kind: 'content' }
  | { readonly kind: 'placeholder'; readonly templateKey: string }
  | { readonly kind: 'placeholder-scene'; readonly marker: string };

// One entry of a node's engagement queue. `storyBeatId` is optional ONLY at
// index 0 (defaults to the node id — the single-engagement shorthand and the
// save-compat rule); validation requires it explicitly on later engagements.
// `armsAfter` names the beat id whose clearing arms this engagement; omitted
// → the previous engagement in the queue.
export interface AtlasEngagement {
  readonly storyBeatId?: string;
  readonly beatsSource: AtlasBeatsSource;
  readonly armsAfter?: string;
}

export interface AtlasNode {
  readonly id: string;
  readonly name: string;
  readonly chapter: number;
  readonly engagements: ReadonlyArray<AtlasEngagement>;
  readonly offset?: number;
  readonly isHub?: boolean;
  readonly farmable?: boolean;
  // Ch1 substrate (WI3): phantom destination — drawn, labeled, never
  // traversable. Exempt from `unreachable`; excluded from the frontier.
  readonly phantom?: boolean;
  // Progressive reveal (S94): shown on the map from campaign start.
  readonly alwaysVisible?: boolean;
  // Layout (world-map viewBox units) — the node-layout.ts slice.
  readonly x: number;
  readonly y: number;
}

export interface AtlasEdge {
  readonly from: string;
  readonly to: string;
  readonly on: 'win' | 'loss';
  // Per-beat edge gating: the beat id whose clearing opens this edge.
  // Omitted → the source node's first engagement (today's behavior).
  readonly opensOnBeat?: string;
  // Ch1 substrate (WI3): phantom edge — rendered dashed, never traversable,
  // contributes nothing to reachability.
  readonly phantom?: boolean;
}

export interface AtlasGraph {
  readonly startId: string;
  readonly nodes: ReadonlyArray<AtlasNode>;
  readonly edges: ReadonlyArray<AtlasEdge>;
}

// The effective cleared-guard beat id of the engagement at `index` — the
// model-side mirror of the runtime `engagementBeatId` default rule. Returns
// undefined (rather than throwing) for a later engagement missing its
// explicit id, so validation can report it as a finding instead of crashing
// the editor mid-keystroke.
export function atlasBeatId(node: AtlasNode, index: number): string | undefined {
  const engagement = node.engagements[index];
  if (engagement === undefined) return undefined;
  if (engagement.storyBeatId !== undefined && engagement.storyBeatId !== '') {
    return engagement.storyBeatId;
  }
  return index === 0 ? node.id : undefined;
}

// Resolve one engagement's beats. Loud-fail by construction: 'content'
// throws on a missing node-content entry, 'placeholder' on an unknown
// template key. A later engagement with no effective beat id resolves its
// content by the (invalid) empty string and throws in contentBeats —
// validation gates that before anything resolves.
export function resolveEngagementBeats(node: AtlasNode, index: number): Engagement['beats'] {
  const engagement = node.engagements[index]!;
  switch (engagement.beatsSource.kind) {
    case 'content':
      return contentBeats(atlasBeatId(node, index) ?? '');
    case 'placeholder':
      return [placeholderBattleBeat(engagement.beatsSource.templateKey)];
    case 'placeholder-scene':
      return [placeholderSceneBeat(engagement.beatsSource.marker)];
  }
}

// A model node's runtime engagement queue.
export function resolveEngagements(node: AtlasNode): ReadonlyArray<Engagement> {
  return node.engagements.map((e, i): Engagement => ({
    ...(e.storyBeatId !== undefined ? { storyBeatId: e.storyBeatId } : {}),
    beats: resolveEngagementBeats(node, i),
    ...(e.armsAfter !== undefined ? { armsAfter: e.armsAfter } : {}),
  }));
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
      engagements: resolveEngagements(n),
      ...(n.offset !== undefined ? { offset: n.offset } : {}),
      ...(n.isHub !== undefined ? { isHub: n.isHub } : {}),
      ...(n.farmable !== undefined ? { farmable: n.farmable } : {}),
      ...(n.phantom !== undefined ? { phantom: n.phantom } : {}),
      ...(n.alwaysVisible !== undefined ? { alwaysVisible: n.alwaysVisible } : {}),
    })),
    edges: model.edges.map((e) => ({
      from: e.from,
      to: e.to,
      on: e.on,
      ...(e.opensOnBeat !== undefined ? { opensOnBeat: e.opensOnBeat } : {}),
      ...(e.phantom !== undefined ? { phantom: e.phantom } : {}),
    })),
  };
}

// The model's layout slice — what the world map (and its march) read.
export function toNodeLayout(model: AtlasGraph): Readonly<Record<string, { x: number; y: number }>> {
  return Object.fromEntries(model.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
}
