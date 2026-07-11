// TABA economy — the navigable map's travel model (M3 economy brief, Stage 1).
//
// The map is no longer a forward-only "pick your next fight": a location is a
// RETURNABLE place. This module owns the pure selectors that say where the
// player can go and what a location currently offers:
//
//   - FORWARD PROGRESS stays win-edge-gated (availability is the hard wall):
//     the frontier is the win-edge targets of story-CLEARED nodes.
//   - RETURN TRAVEL is free to any VISITED node that still offers something
//     (an armed story beat, the skirmish valve, or commerce) — no artificial
//     travel friction (reload-risk is the intended farming governor).
//   - RE-ENTRY resolves what is CURRENTLY available (the driver reads
//     `hasArmedStory` / `isFarmableNow` / `isHubNow` on entry). The one hard
//     rule: an already-cleared story BEAT never replays — the guard is
//     per-beat (`storyBeatIdOf`), so a future re-armed later beat (Dorter
//     pattern) is a legitimate new fight, not a replay.

import { storyBeatIdOf, winChoices, type CampaignGraph, type CampaignNode } from './graph.ts';
import { firstBattleBeat } from './sequence.ts';
import type { CampaignState } from './types.ts';

// Has this node's CURRENT story engagement been fully played?
export function isStoryCleared(state: CampaignState, node: CampaignNode): boolean {
  return state.clearedStoryBeats.includes(storyBeatIdOf(node));
}

// Does this node have a story engagement armed right now (i.e. entering it
// plays beats)? Today a node has one engagement, so armed = not-yet-cleared;
// a future engagement QUEUE changes this selector, not its callers.
export function hasArmedStory(state: CampaignState, node: CampaignNode): boolean {
  return node.beats.length > 0 && !isStoryCleared(state, node);
}

// Is the skirmish valve open here? Farmable-capable AND story cleared (the
// lifecycle: storyBattle armed → cleared → farmable) AND the node actually
// has a battle beat to borrow a battlefield from.
export function isFarmableNow(state: CampaignState, node: CampaignNode): boolean {
  return (
    node.farmable === true &&
    isStoryCleared(state, node) &&
    firstBattleBeat(node.beats) !== undefined
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
// order: the FRONTIER first (win-edge targets of cleared nodes, authored edge
// order, deduped), then returnable VISITED nodes that still offer something.
// The current node is included (as a revisit) when it offers something — the
// map's HERE node is re-enterable, not just a marker.
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

  // Frontier: win-edges out of every story-cleared node, to nodes whose own
  // story is still ahead of the player. (A cleared target falls through to
  // the revisit pass below — its edge no longer advances anything.)
  for (const node of graph.nodes) {
    if (!isStoryCleared(state, node)) continue;
    for (const target of winChoices(graph, node.id)) {
      if (isStoryCleared(state, target)) continue;
      push(target, 'advance');
    }
  }

  // Returnable: visited nodes with something currently on offer (includes
  // the current node — self-re-entry is how you use the place you stand).
  // A visited node whose story is still ARMED reads as 'advance' (entering
  // it fights, it doesn't browse) — e.g. the campaign start before it's won.
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
