// Atlas — import: shipped campaign graph + layout → editor model.
//
// The inverse of codegen.ts, and the first half of the round-trip pin. The
// interesting part is CLASSIFYING each engagement's beats source from a
// resolved runtime value: the generated node.ts stores exactly what
// contentBeats(beatId) / placeholderBattleBeat(key) / placeholderSceneBeat
// (marker) returned, and content is a static module value, so REFERENCE
// equality is the honest test for it — placeholders are classified by their
// constructed shape (registry template + standard cap; the stub-scene
// title). A beats array this importer can't classify means the graph didn't
// come from the canonical generated shape; that's an error, not a
// best-effort import (fail loud, CLAUDE.md).

import type { CampaignGraph, CampaignNode, Engagement } from '@campaign/index.ts';
import {
  contentBeats,
  engagementBeatId,
  hasContentBeats,
  PLACEHOLDER_DEPLOY_CAP,
  PLACEHOLDER_SCENE_TITLE,
} from '@campaign/index.ts';
import { BATTLE_TEMPLATE_REGISTRY } from '@content/battles/registry.ts';
import type { AtlasBeatsSource, AtlasEngagement, AtlasGraph, AtlasNode } from './model.ts';

function classifyEngagement(node: CampaignNode, engagement: Engagement, index: number): AtlasBeatsSource {
  const beatId = engagementBeatId(node, index);
  if (hasContentBeats(beatId) && contentBeats(beatId) === engagement.beats) {
    return { kind: 'content' };
  }
  const only = engagement.beats.length === 1 ? engagement.beats[0] : undefined;
  // A placeholder battle is exactly one enemy-less battle beat on a
  // registered template at the standard deploy cap.
  if (only !== undefined && only.type === 'battle' && only.battle.enemies === undefined) {
    for (const [key, entry] of Object.entries(BATTLE_TEMPLATE_REGISTRY)) {
      if (entry.template === only.battle.template && only.battle.deployCap === PLACEHOLDER_DEPLOY_CAP) {
        return { kind: 'placeholder', templateKey: key };
      }
    }
  }
  // A placeholder scene is exactly one stub-titled single-line scene (the
  // placeholderSceneBeat shape). Content was tested first, so a real scene
  // could even reuse the title without misclassifying.
  if (
    only !== undefined &&
    only.type === 'story-scene' &&
    only.scene.title === PLACEHOLDER_SCENE_TITLE &&
    only.scene.lines.length === 1
  ) {
    return { kind: 'placeholder-scene', marker: only.scene.lines[0]!.text };
  }
  throw new Error(
    `atlas import: engagement ${index} of node '${node.id}' carries beats that are neither ` +
      `node-content nor a placeholder battle/scene — not a canonical generated graph`,
  );
}

function toAtlasEngagements(node: CampaignNode): ReadonlyArray<AtlasEngagement> {
  return node.engagements.map((e, i): AtlasEngagement => ({
    ...(e.storyBeatId !== undefined ? { storyBeatId: e.storyBeatId } : {}),
    beatsSource: classifyEngagement(node, e, i),
    ...(e.armsAfter !== undefined ? { armsAfter: e.armsAfter } : {}),
  }));
}

// Build the editor model from a runtime graph + its layout table. Node,
// edge, and engagement order pass through untouched (all three orders are
// authored data).
export function fromCampaignGraph(
  graph: CampaignGraph,
  layout: Readonly<Record<string, { readonly x: number; readonly y: number }>>,
): AtlasGraph {
  return {
    startId: graph.startId,
    nodes: graph.nodes.map((n): AtlasNode => {
      const pos = layout[n.id];
      if (pos === undefined) {
        throw new Error(`atlas import: node '${n.id}' has no position in the layout table`);
      }
      return {
        id: n.id,
        name: n.name,
        chapter: n.chapter,
        engagements: toAtlasEngagements(n),
        ...(n.offset !== undefined ? { offset: n.offset } : {}),
        ...(n.isHub !== undefined ? { isHub: n.isHub } : {}),
        ...(n.farmable !== undefined ? { farmable: n.farmable } : {}),
        ...(n.phantom !== undefined ? { phantom: n.phantom } : {}),
        x: pos.x,
        y: pos.y,
      };
    }),
    edges: graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      on: e.on,
      ...(e.opensOnBeat !== undefined ? { opensOnBeat: e.opensOnBeat } : {}),
      ...(e.phantom !== undefined ? { phantom: e.phantom } : {}),
    })),
  };
}
