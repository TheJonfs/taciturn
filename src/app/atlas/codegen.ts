// Atlas — codegen: editor model → the shipped TypeScript modules.
//
// Emits src/campaign/node.ts (the structural graph) and
// src/app/interstitial/node-layout.ts (the layout table) as text. The
// output is TYPE-CHECKED SUBSTRATE, not serialized data: the graph stays
// static TS the build verifies, saves keep storing only ids into it, and
// hand-authored content stays behind contentBeats(id) references the
// exporter can't even see. Fidelity contract: importing the shipped graph
// and exporting it again reproduces both files BYTE-IDENTICALLY
// (codegen.test.ts pins this; if you change the emitted shape, regenerate
// the shipped files in the same change).

import type { AtlasGraph, AtlasNode } from './model.ts';

// The identifier key a node id gets in the generated M1_NODES table:
// 'node-river-ridge' → riverRidge. The 'node-' prefix is convention, not
// requirement; any slug camelCases. Collisions are a validation error
// (validate.ts) — the codegen throws as the last line of defense.
export function nodeKey(id: string): string {
  const slug = id.startsWith('node-') ? id.slice('node-'.length) : id;
  const words = slug.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);
  if (words.length === 0) {
    throw new Error(`atlas codegen: node id '${id}' yields no identifier characters`);
  }
  const key = words
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  return /^[0-9]/.test(key) ? `n${key}` : key;
}

function keyTable(model: AtlasGraph): ReadonlyMap<string, string> {
  const byId = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const node of model.nodes) {
    const key = nodeKey(node.id);
    const clash = seen.get(key);
    if (clash !== undefined) {
      throw new Error(`atlas codegen: node ids '${clash}' and '${node.id}' both yield key '${key}'`);
    }
    seen.set(key, node.id);
    byId.set(node.id, key);
  }
  return byId;
}

function ref(keys: ReadonlyMap<string, string>, id: string): string {
  const key = keys.get(id);
  if (key === undefined) {
    throw new Error(`atlas codegen: edge/start references unknown node id '${id}'`);
  }
  return `M1_NODES.${key}`;
}

const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Emit a number the way the source files author them (plain literal; the
// editor rounds drag positions to integers, so no float noise survives).
const num = (n: number): string => String(n);

function nodeLines(node: AtlasNode, keys: ReadonlyMap<string, string>): string {
  const lines: string[] = [];
  lines.push('  {');
  lines.push(`    id: ${ref(keys, node.id)},`);
  lines.push(`    name: ${quote(node.name)},`);
  lines.push(`    chapter: ${num(node.chapter)},`);
  switch (node.beatsSource.kind) {
    case 'content':
      lines.push(`    beats: contentBeats(${ref(keys, node.id)}),`);
      break;
    case 'placeholder':
      lines.push(`    beats: [placeholderBattleBeat(${quote(node.beatsSource.templateKey)})],`);
      break;
    case 'none':
      lines.push('    beats: [],');
      break;
  }
  if (node.storyBeatId !== undefined) lines.push(`    storyBeatId: ${quote(node.storyBeatId)},`);
  if (node.offset !== undefined) lines.push(`    offset: ${num(node.offset)},`);
  if (node.isHub === true) lines.push('    isHub: true,');
  if (node.farmable === true) lines.push('    farmable: true,');
  lines.push('  },');
  return lines.join('\n');
}

const NODE_MODULE_HEADER = `// GENERATED-SHAPED — TABA campaign structural graph (Atlas graph editor).
//
// This module is the codegen output of the Atlas node-authoring tool (the
// \`?atlas\` dev route): nodes, win-edges (authored order = the world map's
// choice order), chapters, capabilities, and each node's beats source.
// Hand edits are legal TypeScript but the next Atlas export OVERWRITES THIS
// FILE WHOLESALE — story scenes, battle beats, and enemy derivation belong
// in node-content.ts (hand-authored, merged by id; the tool never touches
// it). The paired layout module is src/app/interstitial/node-layout.ts.
// The exporter's fidelity is pinned by the Atlas round-trip test.
`;

// The generated src/campaign/node.ts.
export function generateNodeModule(model: AtlasGraph): string {
  const keys = keyTable(model);
  const usesContent = model.nodes.some((n) => n.beatsSource.kind === 'content');
  const usesPlaceholder = model.nodes.some((n) => n.beatsSource.kind === 'placeholder');

  const imports: string[] = [];
  imports.push("import type { CampaignEdge, CampaignGraph, CampaignNode } from './graph.ts';");
  if (usesContent) imports.push("import { contentBeats } from './node-content.ts';");
  if (usesPlaceholder) imports.push("import { placeholderBattleBeat } from './placeholder-beat.ts';");

  const idEntries = model.nodes.map((n) => `  ${keys.get(n.id)!}: ${quote(n.id)},`).join('\n');
  const nodeEntries = model.nodes.map((n) => nodeLines(n, keys)).join('\n');
  const edgeEntries = model.edges
    .map((e) => `  { from: ${ref(keys, e.from)}, to: ${ref(keys, e.to)}, on: ${quote(e.on)} },`)
    .join('\n');

  return `${NODE_MODULE_HEADER}
${imports.join('\n')}

// Node ids — stable identity (CLAUDE.md rule 4), threaded into the save as
// the campaign position. Authored as readable slugs.
export const M1_NODES = {
${idEntries}
} as const;

const NODES: ReadonlyArray<CampaignNode> = [
${nodeEntries}
];

const EDGES: ReadonlyArray<CampaignEdge> = [
${edgeEntries}
];

export const M1_CAMPAIGN_GRAPH: CampaignGraph = {
  startId: ${ref(keys, model.startId)},
  nodes: NODES,
  edges: EDGES,
};
`;
}

const LAYOUT_MODULE_HEADER = `// GENERATED-SHAPED — world-map node layout (Atlas graph editor).
//
// Authored positions for the campaign graph's nodes, in viewBox units. The
// world map + march animation read this table; the Atlas tool (\`?atlas\`)
// owns it as codegen output — drag-to-place rewrites it WHOLESALE on
// export, so keep anything that isn't a node position out of this file.
// The view derives its viewBox from these bounds with the original 640×350
// frame as the floor. Paired with src/campaign/node.ts; round-trip pinned
// by the Atlas codegen test.
`;

// The generated src/app/interstitial/node-layout.ts.
export function generateLayoutModule(model: AtlasGraph): string {
  const keys = keyTable(model);
  const entries = model.nodes
    .map((n) => `  [${ref(keys, n.id)}]: { x: ${num(n.x)}, y: ${num(n.y)} },`)
    .join('\n');

  return `${LAYOUT_MODULE_HEADER}
import { M1_NODES } from '@campaign/index.ts';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export const NODE_LAYOUT: Readonly<Record<string, NodePosition>> = {
${entries}
};
`;
}
