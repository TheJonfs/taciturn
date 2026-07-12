// Atlas — import: shipped campaign graph + layout → editor model.
//
// The inverse of codegen.ts, and the first half of the round-trip pin. The
// interesting part is CLASSIFYING each node's beats source from a resolved
// runtime value: the generated node.ts stores exactly what contentBeats(id)
// / placeholderBattleBeat(key) returned, and every party is a static module
// value, so REFERENCE equality is the honest test — no structural guessing.
// A beats array this importer can't classify means the graph didn't come
// from the canonical generated shape; that's an error, not a best-effort
// import (fail loud, CLAUDE.md).

import type { CampaignGraph, CampaignNode } from '@campaign/index.ts';
import { contentBeats, hasContentBeats, PLACEHOLDER_DEPLOY_CAP } from '@campaign/index.ts';
import { BATTLE_TEMPLATE_REGISTRY } from '@content/battles/registry.ts';
import type { AtlasBeatsSource, AtlasGraph, AtlasNode } from './model.ts';

function classifyBeats(node: CampaignNode): AtlasBeatsSource {
  if (node.beats.length === 0) return { kind: 'none' };
  if (hasContentBeats(node.id) && contentBeats(node.id) === node.beats) {
    return { kind: 'content' };
  }
  // A placeholder is exactly one enemy-less battle beat on a registered
  // template at the standard deploy cap — the placeholderBattleBeat shape.
  const only = node.beats.length === 1 ? node.beats[0] : undefined;
  if (only !== undefined && only.type === 'battle' && only.battle.enemies === undefined) {
    for (const [key, entry] of Object.entries(BATTLE_TEMPLATE_REGISTRY)) {
      if (entry.template === only.battle.template && only.battle.deployCap === PLACEHOLDER_DEPLOY_CAP) {
        return { kind: 'placeholder', templateKey: key };
      }
    }
  }
  throw new Error(
    `atlas import: node '${node.id}' carries beats that are neither node-content ` +
      `nor a placeholder battle — not a canonical generated graph`,
  );
}

// Build the editor model from a runtime graph + its layout table. Node and
// edge order pass through untouched (both orders are authored data).
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
        beatsSource: classifyBeats(n),
        ...(n.storyBeatId !== undefined ? { storyBeatId: n.storyBeatId } : {}),
        ...(n.offset !== undefined ? { offset: n.offset } : {}),
        ...(n.isHub !== undefined ? { isHub: n.isHub } : {}),
        ...(n.farmable !== undefined ? { farmable: n.farmable } : {}),
        x: pos.x,
        y: pos.y,
      };
    }),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, on: e.on })),
  };
}
