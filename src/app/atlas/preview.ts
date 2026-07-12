// Atlas — live map preview plumbing: the STATEFUL PREVIEW WALK.
//
// The preview renders the REAL WorldMapBeatView (the anti-drift payoff) —
// which needs a real WorldMapChoiceBeat. Under engagement queues a
// synthesized "everything on the road here is cleared" state can't express
// the interesting cases (visit a camp, clear engagement A, go do a mission,
// come back for B) — so the preview holds an actual play-through: a
// `PreviewWalk` accumulates visited nodes and cleared beats exactly the way
// a run would. ENTERING a node simulates winning its current engagement
// (the earliest armed-and-uncleared one — one per entry, as the driver
// plays them); entering with nothing armed is a browse, clearing nothing.
// Choices come from the REAL travelChoices selector, so frontier /
// returnable / badges / per-beat gating behave precisely as the shipped
// map would.

import {
  CAMPAIGN_SCHEMA_VERSION,
  currentEngagement,
  getNode,
  travelChoices,
  type CampaignGraph,
  type CampaignState,
  type WorldMapChoiceBeat,
} from '@campaign/index.ts';

const PREVIEW_GIL = 1000;

// The preview's accumulated play-through.
export interface PreviewWalk {
  readonly atId: string;
  readonly visited: ReadonlyArray<string>;
  readonly clearedStoryBeats: ReadonlyArray<string>;
  // What the last step cleared (for the toolbar readout) — undefined on a
  // browse entry.
  readonly lastCleared?: string;
}

// The walk's runtime state (what the travel selectors read).
function walkState(walk: PreviewWalk): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster: [],
    inventory: {},
    gil: PREVIEW_GIL,
    currentNodeId: walk.atId,
    visited: walk.visited,
    clearedStoryBeats: walk.clearedStoryBeats,
    phase: 'awaiting_route',
  };
}

// Enter `nodeId`: stamp visited and, if an engagement is armed there, clear
// it (simulating the win). Pure — returns the next walk.
function enter(graph: CampaignGraph, walk: PreviewWalk, nodeId: string): PreviewWalk {
  const visited = walk.visited.includes(nodeId) ? walk.visited : [...walk.visited, nodeId];
  const probe = { ...walk, atId: nodeId, visited };
  const armed = currentEngagement(walkState(probe), getNode(graph, nodeId));
  if (armed === undefined) {
    const { lastCleared: _dropped, ...rest } = probe;
    return rest;
  }
  return {
    ...probe,
    clearedStoryBeats: [...walk.clearedStoryBeats, armed.beatId],
    lastCleared: armed.beatId,
  };
}

// A fresh walk: standing at the start with its first engagement won (the
// state the driver holds when it first shows the world map).
export function startWalk(graph: CampaignGraph): PreviewWalk {
  return enter(graph, { atId: graph.startId, visited: [], clearedStoryBeats: [] }, graph.startId);
}

// Travel to a destination (the preview map's pick) and resolve the entry.
export function walkTo(graph: CampaignGraph, walk: PreviewWalk, nodeId: string): PreviewWalk {
  return enter(graph, walk, nodeId);
}

// The world-map beat for the walk's current situation.
export function previewWorldMapBeat(graph: CampaignGraph, walk: PreviewWalk): WorldMapChoiceBeat {
  return {
    type: 'world-map-choice',
    fromNodeId: walk.atId,
    choices: travelChoices(graph, walkState(walk)),
    gil: PREVIEW_GIL,
  };
}
