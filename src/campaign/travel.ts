// TABA economy — the navigable map's travel model (M3 economy brief, Stage 1;
// engagement queues + per-beat edge gating, M3).
//
// The map is no longer a forward-only "pick your next fight": a location is a
// RETURNABLE place. This module owns the pure selectors that say where the
// player can go and what a location currently offers:
//
//   - FORWARD PROGRESS is win-EDGE-gated (availability is the hard wall):
//     an edge enters the frontier when its `opensOnBeat` engagement clears
//     (default: the source node's first engagement — which makes the frontier
//     exactly "win-edges of cleared nodes" for single-engagement content).
//   - RETURN TRAVEL is free to any VISITED node that still offers something
//     (an armed story beat, the skirmish valve, or commerce) — no artificial
//     travel friction (reload-risk is the intended farming governor).
//   - RE-ENTRY resolves what is CURRENTLY available (the driver reads
//     `hasArmedStory` / `isFarmableNow` / `isHubNow` on entry). The one hard
//     rule: an already-cleared story BEAT never replays — the guard is
//     per-beat (`engagementBeatId`), so a re-armed later engagement is a
//     legitimate new fight, not a replay.
//
// ENGAGEMENT QUEUES: a node owns an ordered queue; the CURRENT engagement on
// entry is the earliest that is ARMED (first in queue, or its `armsAfter`
// beat is cleared) and NOT CLEARED. "Story-cleared" is TEMPORAL: nothing
// armed-and-uncleared right now. A camp whose next engagement waits on a
// distant beat reads as cleared (its shop stock contributes, it lists as a
// revisit) and flips back to armed when that beat clears elsewhere.

import {
  allNodeBeats,
  engagementBeatId,
  getNode,
  type CampaignEdge,
  type CampaignGraph,
  type CampaignNode,
  type Engagement,
} from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import type { CampaignState } from './types.ts';

// Has the engagement at `index` fully played? (Its beat id is in the save's
// per-beat cleared guard.)
export function isEngagementCleared(
  state: CampaignState,
  node: CampaignNode,
  index: number,
): boolean {
  return state.clearedStoryBeats.includes(engagementBeatId(node, index));
}

// Is the engagement at `index` ARMED — eligible to play once it's the
// earliest uncleared one? The first engagement is armed at node availability;
// a later one arms when its `armsAfter` beat clears (default: the previous
// engagement in the queue, giving sequential camp visits for free).
export function isEngagementArmed(state: CampaignState, node: CampaignNode, index: number): boolean {
  if (index === 0) return true;
  const armsAfter = node.engagements[index]!.armsAfter ?? engagementBeatId(node, index - 1);
  return state.clearedStoryBeats.includes(armsAfter);
}

// The node's CURRENT engagement: the earliest armed-and-uncleared one, with
// its index and effective beat id resolved. Undefined when nothing is armed
// right now (all cleared, or the remainder waits on distant beats) — the
// node is temporally story-complete.
export interface CurrentEngagement {
  readonly engagement: Engagement;
  readonly index: number;
  readonly beatId: string;
}

export function currentEngagement(
  state: CampaignState,
  node: CampaignNode,
): CurrentEngagement | undefined {
  for (let i = 0; i < node.engagements.length; i += 1) {
    if (!isEngagementArmed(state, node, i)) continue;
    if (isEngagementCleared(state, node, i)) continue;
    return { engagement: node.engagements[i]!, index: i, beatId: engagementBeatId(node, i) };
  }
  return undefined;
}

// Is this node's story TEMPORALLY complete — nothing armed-and-uncleared
// right now?
//
// A node with NO engagements (a pure market town: `engagements: []`) has
// nothing to clear — its "story" completes on FIRST VISIT (visit-completes).
// Nothing is recorded in `clearedStoryBeats` (there is no beat id to record).
//
// NOTE this can regress: a camp reads cleared between engagements, then armed
// again when a later engagement's `armsAfter` beat clears elsewhere. Edge
// OPENING deliberately does not read this (it would un-open edges) — see
// `isEdgeOpen`, which is monotonic.
export function isStoryCleared(state: CampaignState, node: CampaignNode): boolean {
  if (node.engagements.length === 0) return state.visited.includes(node.id);
  return currentEngagement(state, node) === undefined;
}

// Does this node have a story engagement armed right now (i.e. entering it
// plays beats)?
export function hasArmedStory(state: CampaignState, node: CampaignNode): boolean {
  return currentEngagement(state, node) !== undefined;
}

// Is the skirmish valve open here? Farmable-capable AND story cleared (the
// lifecycle: storyBattle armed → cleared → farmable) AND the node actually
// has a battle beat (any engagement's) to borrow a battlefield from.
export function isFarmableNow(state: CampaignState, node: CampaignNode): boolean {
  return (
    node.farmable === true &&
    isStoryCleared(state, node) &&
    firstBattleBeat(allNodeBeats(node)) !== undefined
  );
}

// Is commerce open here? (Stage 2/3 read this; hubs trade once visited —
// hub-ness has no clear-gate of its own, per the capability model.)
export function isHubNow(state: CampaignState, node: CampaignNode): boolean {
  return node.isHub === true && state.visited.includes(node.id);
}

// Anything to DO at this node right now? (Drives both re-entry resolution
// and whether a visited node is worth listing as a travel choice.)
export function hasAvailability(state: CampaignState, node: CampaignNode): boolean {
  return hasArmedStory(state, node) || isFarmableNow(state, node) || isHubNow(state, node);
}

// Has this win-edge OPENED as forward progress? Monotonic (cleared beats
// never un-clear): explicit `opensOnBeat` → that beat is cleared; default →
// the source node's FIRST engagement's beat is cleared, or (beat-less
// source) the source has been visited. The default reproduces the pre-queue
// behavior — "clearing a node opens all its win-edges" — exactly, on every
// existing edge.
export function isEdgeOpen(state: CampaignState, graph: CampaignGraph, edge: CampaignEdge): boolean {
  if (edge.opensOnBeat !== undefined) return state.clearedStoryBeats.includes(edge.opensOnBeat);
  const source = getNode(graph, edge.from);
  if (source.engagements.length === 0) return state.visited.includes(source.id);
  return state.clearedStoryBeats.includes(engagementBeatId(source, 0));
}

// One selectable destination on the world map.
export interface TravelChoice {
  readonly id: string;
  readonly name: string;
  // 'advance' — a frontier node (entering plays its armed story beat).
  // 'revisit' — a returnable node (entering offers what's currently there).
  readonly kind: 'advance' | 'revisit';
  // Badges for the map (what the destination offers right now).
  readonly farmable: boolean;
  readonly hub: boolean;
}

// Every destination the player may travel to from the world map, in stable
// order: the FRONTIER first (targets of OPEN win-edges, source-node order
// then authored edge order, deduped), then returnable VISITED nodes that
// still offer something. The current node is included (as a revisit) when it
// offers something — the map's HERE node is re-enterable, not just a marker.
export function travelChoices(graph: CampaignGraph, state: CampaignState): ReadonlyArray<TravelChoice> {
  const seen = new Set<string>();
  const choices: TravelChoice[] = [];

  const push = (node: CampaignNode, kind: TravelChoice['kind']): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    choices.push({
      id: node.id,
      name: node.name,
      kind,
      farmable: isFarmableNow(state, node),
      hub: isHubNow(state, node),
    });
  };

  // Frontier: every OPEN win-edge (per-beat gating), to targets whose own
  // story is still ahead of the player. (A cleared target falls through to
  // the revisit pass below — its edge no longer advances anything.)
  for (const node of graph.nodes) {
    for (const edge of graph.edges) {
      if (edge.from !== node.id || edge.on !== 'win') continue;
      if (!isEdgeOpen(state, graph, edge)) continue;
      const target = getNode(graph, edge.to);
      if (isStoryCleared(state, target)) continue;
      push(target, 'advance');
    }
  }

  // Returnable: visited nodes with something currently on offer (includes
  // the current node — self-re-entry is how you use the place you stand).
  // A visited node whose story is still ARMED reads as 'advance' (entering
  // it fights, it doesn't browse) — e.g. the campaign start before it's won,
  // or a camp whose next engagement just armed.
  for (const node of graph.nodes) {
    if (!state.visited.includes(node.id)) continue;
    if (!hasAvailability(state, node)) continue;
    push(node, hasArmedStory(state, node) ? 'advance' : 'revisit');
  }

  return choices;
}

// Is `nodeId` a legal travel destination? (Guards the route transition.)
export function isTravelChoice(graph: CampaignGraph, state: CampaignState, nodeId: string): boolean {
  return travelChoices(graph, state).some((c) => c.id === nodeId);
}
