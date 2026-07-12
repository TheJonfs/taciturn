// Atlas — live map preview plumbing.
//
// The preview renders the REAL WorldMapBeatView (the anti-drift payoff) —
// which needs a real WorldMapChoiceBeat. This module synthesizes the
// campaign situation "the company stands at node X, having cleared the way
// there": every ancestor of X (and X itself) is visited + story-cleared,
// exactly the state the driver would hold when showing the map after X's
// win. Choices come from the REAL travelChoices selector, so the preview
// shows frontier/returnable/badges precisely as the shipped map would.

import {
  CAMPAIGN_SCHEMA_VERSION,
  getNode,
  storyBeatIdOf,
  travelChoices,
  type CampaignGraph,
  type CampaignState,
  type WorldMapChoiceBeat,
} from '@campaign/index.ts';

const PREVIEW_GIL = 1000;

// X and every node that can reach X via win-edges.
function ancestorsAndSelf(graph: CampaignGraph, atId: string): ReadonlySet<string> {
  const reversed = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.on !== 'win') continue;
    (reversed.get(e.to) ?? reversed.set(e.to, []).get(e.to)!).push(e.from);
  }
  const seen = new Set<string>([atId]);
  const queue = [atId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const prev of reversed.get(at) ?? []) {
      if (!seen.has(prev)) {
        seen.add(prev);
        queue.push(prev);
      }
    }
  }
  return seen;
}

// The world-map beat for "standing at `atId` with the road there cleared".
// Pass a graph that contains atId (the caller resolves the draft model).
export function previewWorldMapBeat(graph: CampaignGraph, atId: string): WorldMapChoiceBeat {
  const cleared = ancestorsAndSelf(graph, atId);
  const visited = [...cleared];
  const clearedStoryBeats = visited
    .map((id) => getNode(graph, id))
    .filter((n) => n.beats.length > 0)
    .map((n) => storyBeatIdOf(n));

  const state: CampaignState = {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    roster: [],
    inventory: {},
    gil: PREVIEW_GIL,
    currentNodeId: atId,
    visited,
    clearedStoryBeats,
    phase: 'awaiting_route',
  };

  return {
    type: 'world-map-choice',
    fromNodeId: atId,
    choices: travelChoices(graph, state),
    gil: PREVIEW_GIL,
  };
}
