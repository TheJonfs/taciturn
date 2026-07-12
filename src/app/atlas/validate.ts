// Atlas — the live validation panel's rule set (substrate notes §2, adapted
// to the structural tier, plus the new chapter-monotonicity rule).
//
// Pure: model in, findings out. ERRORS are invariant violations the runtime
// (or codegen) would fail loud on — export is gated on zero errors.
// WARNINGS are authoring smells the runtime tolerates (an overlap that
// renders badly, a battle-less start the probe fallback covers). Rules the
// substrate records as LIFTED (battle-beat start, battle-beat hub) are
// warnings or absent here, deliberately.

import { contentBeats, hasContentBeats, placeholderBattleBeat } from '@campaign/index.ts';
import type { NodeBeat } from '@campaign/index.ts';
import { BATTLE_TEMPLATE_REGISTRY } from '@content/battles/registry.ts';
import type { AtlasGraph, AtlasNode } from './model.ts';
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

    // storyBeatId uniqueness across ALL engagements — the effective beat id
    // (explicit or defaulted to the node id) is what the cleared guard keys.
    const beatId = node.storyBeatId ?? node.id;
    const beatClash = seenBeatIds.get(beatId);
    if (beatClash !== undefined) {
      out.push({
        level: 'error',
        rule: 'story-beat-id-collision',
        message: `Nodes '${beatClash}' and '${node.id}' share the story-beat id '${beatId}'.`,
        nodeId: node.id,
      });
    }
    seenBeatIds.set(beatId, node.id);
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

// Win-edge adjacency for the reachability/cycle/chapter walks.
function winAdjacency(model: AtlasGraph): ReadonlyMap<string, ReadonlyArray<string>> {
  const adj = new Map<string, string[]>();
  for (const n of model.nodes) adj.set(n.id, []);
  for (const e of model.edges) {
    if (e.on !== 'win') continue;
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
    if (e.on !== 'win') continue;
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

// The resolved beats for validation, or undefined when resolution itself is
// the finding (missing content / unknown template — reported separately).
function tryResolveBeats(node: AtlasNode): ReadonlyArray<NodeBeat> | undefined {
  switch (node.beatsSource.kind) {
    case 'content':
      return hasContentBeats(node.id) ? contentBeats(node.id) : undefined;
    case 'placeholder':
      if (BATTLE_TEMPLATE_REGISTRY[node.beatsSource.templateKey] === undefined) return undefined;
      return [placeholderBattleBeat(node.beatsSource.templateKey)];
    case 'none':
      return [];
  }
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

    // Beats-source resolution.
    if (node.beatsSource.kind === 'content' && !hasContentBeats(node.id)) {
      out.push({
        level: 'error',
        rule: 'content-missing',
        message: `Node '${node.id}' claims hand-authored content but node-content.ts has none under that id.`,
        nodeId: node.id,
      });
    }
    if (node.beatsSource.kind === 'placeholder' && BATTLE_TEMPLATE_REGISTRY[node.beatsSource.templateKey] === undefined) {
      out.push({
        level: 'error',
        rule: 'template-unknown',
        message: `Node '${node.id}' uses unregistered battle template '${node.beatsSource.templateKey}'.`,
        nodeId: node.id,
      });
    }

    const beats = tryResolveBeats(node);
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
    const beats = tryResolveBeats(startNode);
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
  const all = [
    ...findingsForIds(model),
    ...findingsForEdges(model),
    ...findingsForTopology(model),
    ...findingsForNodes(model),
    ...findingsForLayout(model),
  ];
  return [...all.filter((f) => f.level === 'error'), ...all.filter((f) => f.level === 'warning')];
}
