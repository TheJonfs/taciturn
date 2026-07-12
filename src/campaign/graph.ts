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
  // The node's authored beat sequence (M1.5): `story-scene` + `battle` beats
  // in authored order (see sequence.ts). A node with no battle beat is a
  // standalone story node. The graph machinery never reads this — only the
  // driver does, walking the sequence on node entry.
  //
  // M3 economy: `beats` is the node's CURRENT STORY ENGAGEMENT — the thing
  // the per-beat cleared guard tracks (by `storyBeatId`, below). A future
  // multi-beat location (the Dorter re-arm pattern) becomes a QUEUE of
  // engagements each with its own id; the save shape (cleared beat IDS, not
  // cleared node ids) already accommodates that without migration.
  readonly beats: ReadonlyArray<NodeBeat>;

  // --- M3 economy: ORTHOGONAL location capabilities (brief D2). These are
  // independent flags that can coexist and change over campaign progress —
  // deliberately NOT a mutually-exclusive location "type". ---

  // Stable id of the authored engagement above, recorded in the save when
  // cleared (the per-BEAT guard: a later re-armed engagement is a NEW id —
  // a legitimate new fight, not a replay). Omitted → defaults to the node
  // id (the single-engagement shorthand; see `storyBeatIdOf`).
  readonly storyBeatId?: string;
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
}

// The node's engagement id for the cleared guard. Explicit `storyBeatId`
// when authored; the node id otherwise (a single-engagement node needs no
// separate name for its only engagement).
export function storyBeatIdOf(node: CampaignNode): string {
  return node.storyBeatId ?? node.id;
}

// Which battle outcome an edge fires on. M1 authors only `win`.
export type CampaignOutcome = 'win' | 'loss';

// A directed, outcome-aware edge. `from`/`to` are node ids (identity by id —
// CLAUDE.md rule 4).
export interface CampaignEdge {
  readonly from: string;
  readonly to: string;
  readonly on: CampaignOutcome;
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
  return graph.edges
    .filter((e) => e.from === nodeId && e.on === outcome)
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
