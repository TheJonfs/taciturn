// Atlas — the live validation panel's rule set (substrate notes §2, adapted
// to the structural tier, plus the new chapter-monotonicity rule).
//
// Pure: model in, findings out. ERRORS are invariant violations the runtime
// (or codegen) would fail loud on — export is gated on zero errors.
// WARNINGS are authoring smells the runtime tolerates (an overlap that
// renders badly, a battle-less start the probe fallback covers). Rules the
// substrate records as LIFTED (battle-beat start, battle-beat hub) are
// warnings or absent here, deliberately.

import {
  contentBeats,
  hasContentBeats,
  placeholderBattleBeat,
  placeholderSceneBeat,
} from '@campaign/index.ts';
import type { NodeBeat } from '@campaign/index.ts';
import { BATTLE_TEMPLATE_REGISTRY } from '@content/battles/registry.ts';
import { atlasBeatId, type AtlasGraph, type AtlasNode } from './model.ts';
import { nodeKey } from './codegen.ts';

export interface AtlasFinding {
  readonly level: 'error' | 'warning';
  // Stable rule identifier (the tests key on these).
  readonly rule: string;
  readonly message: string;
  // The offending node id, where one exists.
  readonly nodeId?: string;
}

// Node badges/labels overlap below this separation (substrate §2 rule 8).
const MIN_NODE_SEPARATION = 40;

function findingsForIds(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const seenIds = new Map<string, number>();
  const seenKeys = new Map<string, string>();
  const seenBeatIds = new Map<string, string>();

  for (const node of model.nodes) {
    if (node.id.trim() === '') {
      out.push({ level: 'error', rule: 'id-empty', message: 'A node has an empty id.', nodeId: node.id });
      continue;
    }
    seenIds.set(node.id, (seenIds.get(node.id) ?? 0) + 1);

    let key: string | undefined;
    try {
      key = nodeKey(node.id);
    } catch {
      out.push({
        level: 'error',
        rule: 'id-no-key',
        message: `Node id '${node.id}' yields no codegen identifier.`,
        nodeId: node.id,
      });
    }
    if (key !== undefined) {
      const clash = seenKeys.get(key);
      if (clash !== undefined && clash !== node.id) {
        out.push({
          level: 'error',
          rule: 'id-key-collision',
          message: `Node ids '${clash}' and '${node.id}' both codegen to key '${key}'.`,
          nodeId: node.id,
        });
      }
      seenKeys.set(key, node.id);
    }

    // Beat-id rules across the node's ENGAGEMENT QUEUE: every effective beat
    // id (explicit, or the node id for a defaulted first engagement) must be
    // unique across ALL nodes' engagements — the cleared guard keys on them —
    // and every engagement past the first must carry an explicit id (only
    // the first may default; the runtime fails loud otherwise).
    node.engagements.forEach((_, i) => {
      const beatId = atlasBeatId(node, i);
      if (beatId === undefined) {
        out.push({
          level: 'error',
          rule: 'engagement-id-missing',
          message: `Engagement ${i + 1} of '${node.id}' has no storyBeatId — only the first engagement may default to the node id.`,
          nodeId: node.id,
        });
        return;
      }
      const beatClash = seenBeatIds.get(beatId);
      if (beatClash !== undefined) {
        out.push({
          level: 'error',
          rule: 'story-beat-id-collision',
          message: `'${beatClash}' and engagement ${i + 1} of '${node.id}' share the story-beat id '${beatId}'.`,
          nodeId: node.id,
        });
      }
      seenBeatIds.set(beatId, node.id);
    });
  }

  for (const [id, count] of seenIds) {
    if (count > 1) {
      out.push({ level: 'error', rule: 'id-duplicate', message: `Node id '${id}' appears ${count} times.`, nodeId: id });
    }
  }
  return out;
}

function findingsForEdges(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const ids = new Set(model.nodes.map((n) => n.id));
  if (!ids.has(model.startId)) {
    out.push({ level: 'error', rule: 'start-missing', message: `startId '${model.startId}' is not a node.` });
  }
  for (const e of model.edges) {
    for (const end of [e.from, e.to]) {
      if (!ids.has(end)) {
        out.push({
          level: 'error',
          rule: 'edge-dangling',
          message: `Edge ${e.from} → ${e.to} references unknown node '${end}'.`,
          nodeId: end,
        });
      }
    }
    if (e.from === e.to) {
      out.push({
        level: 'error',
        rule: 'edge-self',
        message: `Edge ${e.from} → ${e.to} is a self-loop.`,
        nodeId: e.from,
      });
    }
  }
  return out;
}

// Phantom coherence (Ch1 substrate WI3). A phantom node is a drawn
// destination that must never become enterable: a REAL edge pointing at
// it would put it on the frontier the moment the edge opens — error.
// Engagements on a phantom node are dead content (never played) — warn.
function findingsForPhantoms(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const phantomIds = new Set(model.nodes.filter((n) => n.phantom === true).map((n) => n.id));
  for (const e of model.edges) {
    if (e.phantom === true) continue;
    if (phantomIds.has(e.to)) {
      out.push({
        level: 'error',
        rule: 'phantom-target-real-edge',
        message: `Edge ${e.from} → ${e.to} is a real (non-phantom) edge into phantom node '${e.to}' — it would make the phantom enterable. Mark the edge phantom too.`,
        nodeId: e.to,
      });
    }
  }
  for (const node of model.nodes) {
    if (node.phantom === true && node.engagements.length > 0) {
      out.push({
        level: 'warning',
        rule: 'phantom-with-engagements',
        message: `Phantom node '${node.id}' authors ${node.engagements.length} engagement(s) that can never play.`,
        nodeId: node.id,
      });
    }
  }
  return out;
}

// Every effective beat id in the model (what `armsAfter`/`opensOnBeat` may
// legally reference).
function effectiveBeatIds(model: AtlasGraph): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const node of model.nodes) {
    node.engagements.forEach((_, i) => {
      const beatId = atlasBeatId(node, i);
      if (beatId !== undefined) ids.add(beatId);
    });
  }
  return ids;
}

// Reference resolution for the arming/gating fields (engagement queues WI3):
// `armsAfter` and `opensOnBeat` must name a real engagement's beat id.
function findingsForBeatRefs(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const beatIds = effectiveBeatIds(model);
  for (const node of model.nodes) {
    node.engagements.forEach((engagement, i) => {
      if (engagement.armsAfter !== undefined && !beatIds.has(engagement.armsAfter)) {
        out.push({
          level: 'error',
          rule: 'arms-after-unknown',
          message: `Engagement ${i + 1} of '${node.id}' arms after unknown beat '${engagement.armsAfter}'.`,
          nodeId: node.id,
        });
      }
    });
  }
  for (const e of model.edges) {
    if (e.opensOnBeat !== undefined && !beatIds.has(e.opensOnBeat)) {
      out.push({
        level: 'error',
        rule: 'opens-on-unknown',
        message: `Edge ${e.from} → ${e.to} opens on unknown beat '${e.opensOnBeat}'.`,
        nodeId: e.from,
      });
    }
  }
  return out;
}

// Reachability UNDER GATING (the deep half of the WI3 validator): a joint
// fixpoint over reachable NODES and achievable BEATS.
//
//   - a beat is ACHIEVABLE when its node is reachable and its engagement can
//     arm (first in queue, or its arms-after beat is achievable). An earlier
//     armed-uncleared engagement only DELAYS a later one (clearing it
//     unblocks the queue), so ordering adds no constraint here.
//   - a win-edge is TRAVERSABLE when its gate can satisfy: explicit
//     `opensOnBeat` achievable, or (default) the source's first engagement's
//     beat achievable — or, for a beat-less source, the source reachable
//     (visit-completes).
//   - a node is REACHABLE from the start via traversable edges.
//
// Arming cycles (A arms-after B, B arms-after A) fall out as never-achievable
// beats — no separate cycle walk needed. Runs only when the structural
// prerequisites hold (no dangling refs); the structural `unreachable` rule
// stays separate, and a node it already reported is not re-reported here.
function findingsForGating(model: AtlasGraph, structurallyBroken: boolean): AtlasFinding[] {
  if (structurallyBroken) return [];
  const out: AtlasFinding[] = [];
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  if (!byId.has(model.startId)) return out;

  const reachable = new Set<string>([model.startId]);
  const achievable = new Set<string>();

  // The arms-after requirement of engagement i (undefined = none: index 0).
  const armsRequirement = (node: AtlasNode, i: number): string | undefined => {
    if (i === 0) return undefined;
    return node.engagements[i]!.armsAfter ?? atlasBeatId(node, i - 1);
  };

  // Can this edge's gate ever satisfy, given the current achievable set?
  const traversable = (edge: { from: string; opensOnBeat?: string | undefined }): boolean => {
    if (edge.opensOnBeat !== undefined) return achievable.has(edge.opensOnBeat);
    const source = byId.get(edge.from);
    if (source === undefined) return false;
    if (source.engagements.length === 0) return reachable.has(source.id);
    const firstBeat = atlasBeatId(source, 0);
    return firstBeat !== undefined && achievable.has(firstBeat);
  };

  // Fixpoint: keep sweeping until neither set grows. Graphs are authoring-
  // sized (tens of nodes), so the quadratic sweep is fine.
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of model.nodes) {
      if (!reachable.has(node.id)) continue;
      node.engagements.forEach((_, i) => {
        const beatId = atlasBeatId(node, i);
        if (beatId === undefined || achievable.has(beatId)) return;
        const requirement = armsRequirement(node, i);
        if (requirement !== undefined && !achievable.has(requirement)) return;
        achievable.add(beatId);
        grew = true;
      });
    }
    for (const e of model.edges) {
      if (e.on !== 'win' || e.phantom === true) continue;
      if (!reachable.has(e.from) || reachable.has(e.to)) continue;
      if (!traversable(e)) continue;
      reachable.add(e.to);
      grew = true;
    }
  }

  // Structural reachability (ungated win-edge BFS) for de-duplication: a node
  // the plain `unreachable` rule already reported is not re-reported here.
  const structural = new Set<string>([model.startId]);
  const queue = [model.startId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const e of model.edges) {
      if (e.on !== 'win' || e.phantom === true || e.from !== at || structural.has(e.to)) continue;
      if (!byId.has(e.to)) continue;
      structural.add(e.to);
      queue.push(e.to);
    }
  }

  for (const node of model.nodes) {
    if (node.phantom === true) continue; // unreachable by design (WI3)
    if (!reachable.has(node.id) && structural.has(node.id)) {
      out.push({
        level: 'error',
        rule: 'unreachable-under-gating',
        message: `'${node.name}' (${node.id}) is unreachable once edge gates and arming are accounted for.`,
        nodeId: node.id,
      });
    }
    node.engagements.forEach((_, i) => {
      const beatId = atlasBeatId(node, i);
      if (beatId === undefined) return;
      if (reachable.has(node.id) && !achievable.has(beatId)) {
        out.push({
          level: 'error',
          rule: 'engagement-never-arms',
          message: `Engagement ${i + 1} of '${node.id}' ('${beatId}') can never arm — its arms-after chain never clears.`,
          nodeId: node.id,
        });
      }
    });
  }
  return out;
}

// Win-edge adjacency for the reachability/cycle/chapter walks. Phantom
// edges (WI3) are excluded: they contribute nothing to reachability —
// a phantom edge cannot make its target reachable, mask a real
// unreachable node, or form a runtime cycle.
function winAdjacency(model: AtlasGraph): ReadonlyMap<string, ReadonlyArray<string>> {
  const adj = new Map<string, string[]>();
  for (const n of model.nodes) adj.set(n.id, []);
  for (const e of model.edges) {
    if (e.on !== 'win' || e.phantom === true) continue;
    adj.get(e.from)?.push(e.to);
  }
  return adj;
}

function findingsForTopology(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const adj = winAdjacency(model);
  if (!adj.has(model.startId)) return out; // start-missing already reported

  // Reachability from the start.
  const reachable = new Set<string>([model.startId]);
  const queue = [model.startId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of adj.get(at) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  for (const n of model.nodes) {
    // Phantom nodes (WI3) are unreachable BY DESIGN — exempt. The check
    // is per-node on the flag, so a real unreachable node next to a
    // phantom one still fires.
    if (n.phantom === true) continue;
    if (!reachable.has(n.id)) {
      out.push({
        level: 'error',
        rule: 'unreachable',
        message: `'${n.name}' (${n.id}) is not reachable from the start via win-edges.`,
        nodeId: n.id,
      });
    }
  }

  // At least one reachable terminal (or the campaign can't complete).
  const hasTerminal = [...reachable].some((id) => (adj.get(id) ?? []).length === 0);
  if (!hasTerminal) {
    out.push({
      level: 'error',
      rule: 'no-terminal',
      message: 'No terminal node (zero win-edges) is reachable — the campaign cannot complete.',
    });
  }

  // Forward-DAG: win-edges must be acyclic (graph.ts documents the model as
  // a forward DAG; the driver and the economy's monotonic availability both
  // assume forward progress).
  const state = new Map<string, 'visiting' | 'done'>();
  const cycleAt = (id: string): string | undefined => {
    state.set(id, 'visiting');
    for (const next of adj.get(id) ?? []) {
      const s = state.get(next);
      if (s === 'visiting') return next;
      if (s === undefined) {
        const found = cycleAt(next);
        if (found !== undefined) return found;
      }
    }
    state.set(id, 'done');
    return undefined;
  };
  for (const n of model.nodes) {
    if (state.has(n.id)) continue;
    const found = cycleAt(n.id);
    if (found !== undefined) {
      out.push({
        level: 'error',
        rule: 'cycle',
        message: `Win-edges form a cycle through '${found}' — the graph must be a forward DAG.`,
        nodeId: found,
      });
      break; // one report is enough; fixing it re-runs validation live
    }
  }

  // THE NEW RULE — chapter monotonic non-decreasing along win-edges: an edge
  // may not lead to an earlier chapter (keeps chapter tags consistent with
  // actual reachability).
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  for (const e of model.edges) {
    // Phantom edges are decoration, not progression — chapter
    // monotonicity doesn't apply to a road that is never walked.
    if (e.on !== 'win' || e.phantom === true) continue;
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (from === undefined || to === undefined) continue; // dangling already reported
    if (to.chapter < from.chapter) {
      out.push({
        level: 'error',
        rule: 'chapter-regression',
        message: `Edge ${e.from} (ch${from.chapter}) → ${e.to} (ch${to.chapter}) leads to an earlier chapter.`,
        nodeId: e.to,
      });
    }
  }
  return out;
}

// The resolved beats of ONE engagement for validation, or undefined when
// resolution itself is the finding (missing content / unknown template /
// missing beat id — reported separately).
function tryResolveEngagementBeats(node: AtlasNode, index: number): ReadonlyArray<NodeBeat> | undefined {
  const engagement = node.engagements[index]!;
  switch (engagement.beatsSource.kind) {
    case 'content': {
      const beatId = atlasBeatId(node, index);
      if (beatId === undefined || !hasContentBeats(beatId)) return undefined;
      return contentBeats(beatId);
    }
    case 'placeholder':
      if (BATTLE_TEMPLATE_REGISTRY[engagement.beatsSource.templateKey] === undefined) return undefined;
      return [placeholderBattleBeat(engagement.beatsSource.templateKey)];
    case 'placeholder-scene':
      return [placeholderSceneBeat(engagement.beatsSource.marker)];
  }
}

// Every beat of every FULLY-RESOLVING node, or undefined if any engagement
// fails to resolve (battle-dependent checks are skipped rather than judged
// on partial information).
function tryResolveAllBeats(node: AtlasNode): ReadonlyArray<NodeBeat> | undefined {
  const resolved = node.engagements.map((_, i) => tryResolveEngagementBeats(node, i));
  if (resolved.some((r) => r === undefined)) return undefined;
  return resolved.flatMap((r) => r!);
}

function findingsForNodes(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  const startNode = model.nodes.find((n) => n.id === model.startId);

  for (const node of model.nodes) {
    if (node.name.trim() === '') {
      out.push({ level: 'error', rule: 'name-empty', message: `Node '${node.id}' has an empty name.`, nodeId: node.id });
    }
    if (!Number.isInteger(node.chapter) || node.chapter < 1) {
      out.push({
        level: 'error',
        rule: 'chapter-invalid',
        message: `Node '${node.id}' has chapter ${node.chapter} — chapters are integers ≥ 1.`,
        nodeId: node.id,
      });
    }

    // Per-engagement beats-source resolution.
    node.engagements.forEach((engagement, i) => {
      const beatId = atlasBeatId(node, i);
      if (engagement.beatsSource.kind === 'content' && beatId !== undefined && !hasContentBeats(beatId)) {
        out.push({
          level: 'error',
          rule: 'content-missing',
          message: `Engagement ${i + 1} of '${node.id}' claims hand-authored content but node-content.ts has none under beat id '${beatId}'.`,
          nodeId: node.id,
        });
      }
      if (
        engagement.beatsSource.kind === 'placeholder' &&
        BATTLE_TEMPLATE_REGISTRY[engagement.beatsSource.templateKey] === undefined
      ) {
        out.push({
          level: 'error',
          rule: 'template-unknown',
          message: `Engagement ${i + 1} of '${node.id}' uses unregistered battle template '${engagement.beatsSource.templateKey}'.`,
          nodeId: node.id,
        });
      }
      if (engagement.beatsSource.kind === 'placeholder-scene' && engagement.beatsSource.marker.trim() === '') {
        out.push({
          level: 'warning',
          rule: 'scene-marker-empty',
          message: `Engagement ${i + 1} of '${node.id}' is a placeholder scene with no marker text.`,
          nodeId: node.id,
        });
      }
    });

    const beats = tryResolveAllBeats(node);
    const hasBattle = beats !== undefined && beats.some((b) => b.type === 'battle');

    // farmable requires a battle beat (the skirmish borrows the node's
    // battlefield) — still a hard invariant.
    if (node.farmable === true && beats !== undefined && !hasBattle) {
      out.push({
        level: 'error',
        rule: 'farmable-no-battle',
        message: `'${node.name}' is farmable but has no battle beat to borrow a battlefield from.`,
        nodeId: node.id,
      });
    }

    // deployCap ≤ the template's player slots; authored enemies ≤ the
    // template's enemy slots (extras would pass through unfolded).
    if (beats !== undefined) {
      for (const beat of beats) {
        if (beat.type !== 'battle') continue;
        const playerSlots = beat.battle.template.units.filter((u) => u.team === beat.battle.playerTeam).length;
        if (beat.battle.deployCap > playerSlots) {
          out.push({
            level: 'error',
            rule: 'deploy-cap-overflow',
            message: `'${node.name}' has deployCap ${beat.battle.deployCap} but its template has ${playerSlots} player slots.`,
            nodeId: node.id,
          });
        }
        const enemySlots = beat.battle.template.units.filter((u) => u.team !== beat.battle.playerTeam).length;
        if ((beat.battle.enemies?.length ?? 0) > enemySlots) {
          out.push({
            level: 'error',
            rule: 'enemies-overflow',
            message: `'${node.name}' authors ${beat.battle.enemies!.length} enemies over ${enemySlots} template slots.`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  // A battle-less START is legal since the canonical-probe fallback (S88)
  // but almost never what an author wants for battle one — warn, don't block.
  if (startNode !== undefined) {
    const beats = tryResolveAllBeats(startNode);
    if (beats !== undefined && !beats.some((b) => b.type === 'battle')) {
      out.push({
        level: 'warning',
        rule: 'start-no-battle',
        message: `The start node '${startNode.name}' has no battle beat (legal via the probe fallback, but unusual).`,
        nodeId: startNode.id,
      });
    }
  }
  return out;
}

function findingsForLayout(model: AtlasGraph): AtlasFinding[] {
  const out: AtlasFinding[] = [];
  for (let i = 0; i < model.nodes.length; i += 1) {
    for (let j = i + 1; j < model.nodes.length; j += 1) {
      const a = model.nodes[i]!;
      const b = model.nodes[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_NODE_SEPARATION) {
        out.push({
          level: 'warning',
          rule: 'layout-overlap',
          message: `'${a.name}' and '${b.name}' are closer than ${MIN_NODE_SEPARATION} viewBox units — labels will collide.`,
          nodeId: b.id,
        });
      }
    }
  }
  return out;
}

// Run every rule. Errors first (export is gated on zero errors), then
// warnings, both in rule-source order.
export function validateAtlasGraph(model: AtlasGraph): ReadonlyArray<AtlasFinding> {
  const ids = findingsForIds(model);
  const edges = findingsForEdges(model);
  const beatRefs = findingsForBeatRefs(model);
  // The gating fixpoint only runs on structurally-sound input — dangling
  // ids/refs would make its verdicts noise on top of the real findings.
  const structurallyBroken = [...ids, ...edges, ...beatRefs].some((f) => f.level === 'error');
  const all = [
    ...ids,
    ...edges,
    ...beatRefs,
    ...findingsForPhantoms(model),
    ...findingsForTopology(model),
    ...findingsForGating(model, structurallyBroken),
    ...findingsForNodes(model),
    ...findingsForLayout(model),
  ];
  return [...all.filter((f) => f.level === 'error'), ...all.filter((f) => f.level === 'warning')];
}
