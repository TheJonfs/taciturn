// TABA campaign — the branching node-graph model + routing (M1 / M1.5).
//
// M0 shipped a linear A→B graph as a flat array walked by index. M1
// generalizes that to **nodes + outcome-aware directed edges** (taba-m1-brief
// Chunk 1). The model is the expensive-to-rework part, so it is built
// forward-compatible past what M1 authors:
//
//   - EDGES ARE OUTCOME-AWARE. A `CampaignEdge` carries `on: 'win' | 'loss'`.
//     M1 content authors only win-edges (loss = retry the same node, handled
//     in the driver, exactly as M0). Authored loss-routing is expressible but
//     unauthored (D1). The model doesn't special-case it.
//   - A NODE'S WIN-EDGES ARE THE PLAYER'S MAP CHOICES. Winning a node exposes
//     its out-edges; the player picks the next node at the world map (D1).
//     Linear = one win-edge; a fork = 2+; a terminal node = zero. A skippable
//     side-node needs NO special machinery: the node before it has win-edges
//     to BOTH the side-node and the rejoin target, and the side-node has a
//     win-edge to the rejoin target. "Skip" is just picking the rejoin edge.
//   - A NODE IS A BEAT SEQUENCE (M1.5). A node owns an ordered `beats:
//     NodeBeat[]` where a battle is one beat-type among others (see
//     sequence.ts). A node with no battle beat is a standalone story node;
//     `requireBattle` is gone — the graph machinery is entirely beat-agnostic,
//     and only the driver walks the sequence.
//
// This module is PURE: types + structural lookups + routing. The authored
// graph lives in node.ts; the loop transitions that consume routing live in
// loop.ts. The beat model (incl. `NodeBattle`) lives in sequence.ts.

import type { NodeBeat } from './sequence.ts';

// One story engagement at a node: a beat sequence that clears (once, forever)
// under its own beat id. A node owns an ORDERED QUEUE of these (the Igros/
// Dorter re-arm pattern — return to a location for a NEW story that opens a
// DIFFERENT path). Today most nodes have exactly one; the queue is the
// engagement-queues feature (M3, after ADR-0145 built the per-beat save
// guard precisely so this needs no migration).
export interface Engagement {
  // Stable id recorded in `clearedStoryBeats` when this engagement fully
  // plays (the per-BEAT cleared guard). OPTIONAL ONLY FOR THE FIRST
  // engagement, where it defaults to the node id — that default is what
  // keeps pre-queue saves loading (they recorded node ids). Later
  // engagements must author an explicit id (`engagementBeatId` fails loud;
  // Atlas validation gates it before export).
  readonly storyBeatId?: string;
  // This engagement's scene/battle sequence (see sequence.ts).
  readonly beats: ReadonlyArray<NodeBeat>;
  // The beat id whose clearing ARMS this engagement (it may live at any
  // node — "the camp re-arms after you clear a mission elsewhere"). Omitted
  // → the previous engagement in this queue (sequential visits for free).
  // The first engagement is armed at node availability; `armsAfter` on it
  // is meaningless and ignored.
  readonly armsAfter?: string;
}

export interface CampaignNode {
  readonly id: string;
  readonly name: string;
  // The chapter of FIRST APPEARANCE (node-authoring structural tier, S90).
  // Organizational/tiering metadata — canvas regions in the Atlas editor,
  // the equipment lineup's Ch1/2/3 economy tiers, display grouping. It is
  // deliberately NOT a reachability gate: reachability stays DAG-driven,
  // and authoring validation keeps `chapter` consistent with the DAG
  // (non-decreasing along win-edges). Monotonic map: once a node's chapter
  // is reached the node persists; there is no disappearance field.
  readonly chapter: number;
  // The node's ORDERED ENGAGEMENT QUEUE (M3 engagement-queues; was a single
  // implicit engagement `beats: NodeBeat[]` before). Each engagement clears
  // independently under its own beat id; the CURRENT one on entry is the
  // earliest that is armed and not yet cleared (travel.ts owns those
  // selectors — the graph machinery never reads beats; only the driver
  // walks them). `engagements: []` is a pure market town / waypoint: its
  // "story" completes on first visit (visit-completes, travel.ts).
  readonly engagements: ReadonlyArray<Engagement>;

  // --- M3 economy: ORTHOGONAL location capabilities (brief D2). These are
  // independent flags that can coexist and change over campaign progress —
  // deliberately NOT a mutually-exclusive location "type". ---
  // The node's enemy-level offset — the ONE scaling lever (enemy-level.ts):
  // skirmish level = resolveEnemyLevel(partyAvg, offset). Omitted → 0.
  readonly offset?: number;
  // Commerce (shop + recruitment) available here once visited (M3 Stages
  // 2–3). Omitted → false.
  readonly isHub?: boolean;
  // The skirmish valve: once this node's story engagement is cleared, it
  // offers a repeatable on-demand skirmish (M4 replaces the generated-party
  // stub at the `generateSkirmishParty` seam). Omitted → false.
  readonly farmable?: boolean;
  // Ch1 substrate (WI3): a PHANTOM destination — shown on the map (labeled,
  // with its dashed phantom edge) but never traversable: it never enters
  // the frontier, travel, or reachability. Viura beyond Old Ordal is the
  // first: the border town the party can see but the chapter never lets
  // them reach. Validation exempts phantom nodes from `unreachable` (they
  // are unreachable BY DESIGN) without loosening the rule for real nodes.
  // Omitted → false.
  readonly phantom?: boolean;
  // Progressive map reveal (S94, Chris): the world map hides nodes until
  // the party has visited them or they enter the travel frontier — EXCEPT
  // nodes flagged always-visible, which show from campaign start (Old
  // Ordal + Viura: the destination tease before the Mount Eska rug-pull).
  // Presentation-only — never affects travel/reachability. Omitted → false.
  readonly alwaysVisible?: boolean;
}

// The cleared-guard beat id of the engagement at `index`. Explicit
// `storyBeatId` when authored; the FIRST engagement defaults to the node id
// (the single-engagement shorthand — and the pre-queue save compatibility:
// old saves recorded node ids). A LATER engagement without an explicit id is
// an authoring bug — fail loud (Atlas validation gates it before export).
export function engagementBeatId(node: CampaignNode, index: number): string {
  const engagement = node.engagements[index];
  if (engagement === undefined) {
    throw new Error(`engagementBeatId: node "${node.id}" has no engagement at index ${index}`);
  }
  if (engagement.storyBeatId !== undefined) return engagement.storyBeatId;
  if (index === 0) return node.id;
  throw new Error(
    `engagementBeatId: engagement ${index} of node "${node.id}" has no explicit storyBeatId ` +
      '(only the first engagement may default to the node id)',
  );
}

// Every beat of every engagement at this node, in queue order. The helpers
// that need "a battle beat somewhere at this node" (skirmish battlefield
// borrowing, the roster-vitals probe) read this — they don't care which
// engagement the beat belongs to.
export function allNodeBeats(node: CampaignNode): ReadonlyArray<NodeBeat> {
  return node.engagements.flatMap((e) => e.beats);
}

// Which battle outcome an edge fires on. M1 authors only `win`.
export type CampaignOutcome = 'win' | 'loss';

// A directed, outcome-aware edge. `from`/`to` are node ids (identity by id —
// CLAUDE.md rule 4).
export interface CampaignEdge {
  readonly from: string;
  readonly to: string;
  readonly on: CampaignOutcome;
  // Per-beat edge gating (M3 engagement-queues): the beat id whose clearing
  // opens this edge as forward progress — so engagement A of a camp opens
  // the path to mission X while engagement B opens the path to mission Y.
  // Omitted → the edge opens when the source node's FIRST engagement clears
  // (or on first visit for a beat-less source) — exactly today's "clearing
  // a node opens all its win-edges" for single-engagement content. Openness
  // is MONOTONIC either way: cleared beats never un-clear, so an opened
  // edge never closes (consistent with the monotonic map).
  readonly opensOnBeat?: string;
  // Ch1 substrate (WI3): a PHANTOM edge — rendered (dashed) but never
  // traversable: excluded from the frontier (`isEdgeOpen` is always false),
  // from route legality, and from reachability. Draws the road the party
  // can see but the chapter never opens (Old Ordal → Viura). Omitted →
  // false.
  readonly phantom?: boolean;
}

// The whole authored graph: a forward DAG (D2) with a single entry node.
// Static authored content — never serialized; the save stores only the
// position into it (a node id). M1's graph is small but exercises a real
// player-choice fork + a skippable side-node.
export interface CampaignGraph {
  readonly startId: string;
  readonly nodes: ReadonlyArray<CampaignNode>;
  readonly edges: ReadonlyArray<CampaignEdge>;
}

// Look up a node by id. Throws loudly on an unknown id (a graph/position
// bug) rather than returning undefined — fail loud (CLAUDE.md anti-pattern).
export function getNode(graph: CampaignGraph, id: string): CampaignNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (node === undefined) {
    throw new Error(`getNode: no node with id "${id}" in the campaign graph`);
  }
  return node;
}

// The nodes reachable from `nodeId` on the given outcome — the targets of its
// matching out-edges, resolved to nodes (each `to` must exist). Order follows
// the authored edge order (the map renders choices in this order).
export function nextNodes(
  graph: CampaignGraph,
  nodeId: string,
  outcome: CampaignOutcome,
): ReadonlyArray<CampaignNode> {
  // Phantom edges are decoration, not routes (WI3): they never yield a
  // next node — so `winChoices` can't offer them, `isWinChoice` can't
  // route through them, and `isTerminal` ignores them (a node whose only
  // out-edge is phantom IS terminal).
  return graph.edges
    .filter((e) => e.from === nodeId && e.on === outcome && e.phantom !== true)
    .map((e) => getNode(graph, e.to));
}

// The player's map choices after winning `nodeId` — its win-edge targets.
export function winChoices(graph: CampaignGraph, nodeId: string): ReadonlyArray<CampaignNode> {
  return nextNodes(graph, nodeId, 'win');
}

// A node is terminal when winning it leads nowhere (no win-edges): clearing
// it completes the campaign.
export function isTerminal(graph: CampaignGraph, nodeId: string): boolean {
  return winChoices(graph, nodeId).length === 0;
}

// Is `nextId` a legal win-choice from `fromId`? (Guards the route transition
// so the driver can't route to an unreachable node.)
export function isWinChoice(graph: CampaignGraph, fromId: string, nextId: string): boolean {
  return winChoices(graph, fromId).some((n) => n.id === nextId);
}
