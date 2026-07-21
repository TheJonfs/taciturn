// Cartographer — codegen: editor model → the shipped TypeScript modules.
//
// Emits one battle-map module per map (src/content/maps/<slug>.ts) and the
// whole deployment-zone registry (src/content/deployment/registry.ts) as
// text. Like Atlas, the output is TYPE-CHECKED SUBSTRATE, not serialized
// data. Fidelity contract: importing a shipped map's spec and exporting it
// again reproduces the module BYTE-IDENTICALLY, and likewise the registry
// (codegen.test.ts pins this; if you change the emitted shape, regenerate
// the shipped files in the same change).

import type { MapSpec } from '@content/maps/map-format.ts';
import type { LineupSpec } from '@content/battles/lineup-format.ts';
import type { MapZoneEntry, ZoneSubZone, ZoneTeamEntry } from './model.ts';

const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// 'alvera_village' → 'ALVERA_VILLAGE' / 'alveraVillage' / 'alvera-village'.
// Keys are the identity everything derives from; a malformed one fails loud.
function assertKey(key: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error(
      `cartographer codegen: map key '${key}' must be snake_case ([a-z][a-z0-9_]*)`,
    );
  }
}

export function constPrefix(key: string): string {
  assertKey(key);
  return key.toUpperCase();
}

export function camelKey(key: string): string {
  assertKey(key);
  const words = key.split('_').filter((w) => w.length > 0);
  return words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

export function docSlug(key: string): string {
  assertKey(key);
  return key.replace(/_/g, '-');
}

const pascal = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Map module
// ---------------------------------------------------------------------------

const MAP_MODULE_HEADER = `// GENERATED-SHAPED — battle-map module (Cartographer map editor).
//
// This module is codegen output of the Cartographer map-authoring tool (the
// \`?cartographer\` dev route): the map's spec — elevation grid, terrain
// bands, overrides, property tags, and layer-1 decks — plus the built
// BattleMap. Hand edits are legal TypeScript but the next Cartographer
// export of this map OVERWRITES THE FILE WHOLESALE. Geography and design
// prose live in the map's doc (see the spec comment below); deployment
// zones live in src/content/deployment/registry.ts. Round-trip fidelity is
// pinned by the Cartographer codegen test.
`;

// Canonical ordering for position-keyed lists: row-major (y, then x) — the
// codegen sorts so editor insertion order never leaks into the bytes.
const byRowMajor = <T extends { readonly x: number; readonly y: number }>(
  items: ReadonlyArray<T>,
): T[] => [...items].sort((a, b) => (a.y - b.y === 0 ? a.x - b.x : a.y - b.y));

const propertiesExpr = (properties: ReadonlyArray<string>): string =>
  `[${properties.map(quote).join(', ')}]`;

// The generated src/content/maps/<slug>.ts.
export function generateMapModule(spec: MapSpec): string {
  const PREFIX = constPrefix(spec.key);
  const camel = camelKey(spec.key);

  const bandLines = spec.bands
    .map((b) => `    { when: ${quote(b.when)}, elevation: ${b.elevation}, terrain: ${quote(b.terrain)} },`)
    .join('\n');
  const bandsExpr = spec.bands.length === 0 ? '  bands: [],' : `  bands: [\n${bandLines}\n  ],`;

  const gridLines = spec.elevation
    .map((row) => `    [${row.join(', ')}],`)
    .join('\n');

  const overrides = byRowMajor(spec.terrainOverrides)
    .map((o) => `    { x: ${o.x}, y: ${o.y}, terrain: ${quote(o.terrain)} },`)
    .join('\n');
  const overridesExpr =
    spec.terrainOverrides.length === 0
      ? '  terrainOverrides: [],'
      : `  terrainOverrides: [\n${overrides}\n  ],`;

  const tags = byRowMajor(spec.properties)
    .map((p) => `    { x: ${p.x}, y: ${p.y}, properties: ${propertiesExpr(p.properties)} },`)
    .join('\n');
  const tagsExpr =
    spec.properties.length === 0 ? '  properties: [],' : `  properties: [\n${tags}\n  ],`;

  const decks = byRowMajor(spec.decks)
    .map(
      (d) =>
        `    { x: ${d.x}, y: ${d.y}, elevation: ${d.elevation}, terrain: ${quote(d.terrain)}, properties: ${propertiesExpr(d.properties)} },`,
    )
    .join('\n');
  const decksExpr = spec.decks.length === 0 ? '  decks: [],' : `  decks: [\n${decks}\n  ],`;

  return `${MAP_MODULE_HEADER}
import type { BattleMap } from '@engine/index.ts';

import { buildMapFromSpec, type MapSpec } from './map-format.ts';

export const ${PREFIX}_WIDTH = ${spec.width};
export const ${PREFIX}_HEIGHT = ${spec.height};

// ${spec.label} (${spec.width}×${spec.height}) — prose: docs/maps/${docSlug(spec.key)}.md.
export const ${PREFIX}_SPEC: MapSpec = {
  key: ${quote(spec.key)},
  label: ${quote(spec.label)},
  width: ${PREFIX}_WIDTH,
  height: ${PREFIX}_HEIGHT,
${bandsExpr}
  elevation: [
${gridLines}
  ],
${overridesExpr}
${tagsExpr}
${decksExpr}
};

export const ${camel}: BattleMap = buildMapFromSpec(${PREFIX}_SPEC);
`;
}

// ---------------------------------------------------------------------------
// Deployment-zone registry module
// ---------------------------------------------------------------------------

const ZONE_MODULE_HEADER = `// GENERATED-SHAPED — per-map deployment-zone registry (Cartographer map editor).
//
// The seam between terrain and deployment layout (S70): a map key maps to
// one-or-more named zone configs; callers pair a chosen config with the
// terrain (\`assembleBattlefield\`). The machinery that *selects* a config by
// context (story vs random battle) is deliberately NOT here — this registry
// just holds configs.
// This module is codegen output of the Cartographer map-authoring tool (the
// \`?cartographer\` dev route): hand edits are legal TypeScript but the next
// Cartographer export OVERWRITES THIS FILE WHOLESALE. Round-trip fidelity
// is pinned by the Cartographer codegen test.
`;

const TEAM_CONST: Readonly<Record<string, string>> = {
  team_a: 'TEAM_BLUE',
  team_b: 'TEAM_RED',
};

function teamConst(team: string): string {
  const name = TEAM_CONST[team];
  if (name === undefined) {
    throw new Error(`cartographer codegen: unknown team id '${team}' in zone config`);
  }
  return name;
}

// If the tiles are exactly an inclusive layer-0 rectangle enumerated
// row-major, return its bounds — those lists emit as rect() calls.
function asRect(
  tiles: ReadonlyArray<{ readonly x: number; readonly y: number; readonly layer: number }>,
): { x0: number; x1: number; y0: number; y1: number } | null {
  if (tiles.length === 0) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tiles) {
    if (t.layer !== 0) return null;
    x0 = Math.min(x0, t.x);
    x1 = Math.max(x1, t.x);
    y0 = Math.min(y0, t.y);
    y1 = Math.max(y1, t.y);
  }
  if (tiles.length !== (x1 - x0 + 1) * (y1 - y0 + 1)) return null;
  let i = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[i]!;
      if (t.x !== x || t.y !== y) return null;
      i++;
    }
  }
  return { x0, x1, y0, y1 };
}

// Canonical order: row-major within layer. Shipped lists are already
// row-major (rect() enumerates that way), so sorting is the identity on
// them — and editor paint order never leaks into the bytes.
const sortTiles = (
  tiles: ReadonlyArray<{ readonly x: number; readonly y: number; readonly layer: number }>,
): Array<{ readonly x: number; readonly y: number; readonly layer: number }> =>
  [...tiles].sort((a, b) =>
    a.layer - b.layer !== 0 ? a.layer - b.layer : a.y - b.y !== 0 ? a.y - b.y : a.x - b.x,
  );

function tilesExpr(sub: ZoneSubZone, indent: string): string {
  const tiles = sortTiles(sub.tiles);
  if (tiles.length === 0) return '[]';
  const r = asRect(tiles);
  if (r !== null) return `rect(${r.x0}, ${r.x1}, ${r.y0}, ${r.y1})`;
  const lines = tiles
    .map((t) => `${indent}  { x: ${t.x}, y: ${t.y}, layer: ${t.layer} },`)
    .join('\n');
  return `[\n${lines}\n${indent}]`;
}

function teamLines(entry: ZoneTeamEntry): string {
  const simple =
    entry.subZones.length === 1 &&
    entry.subZones[0]!.cap === undefined &&
    asRect(sortTiles(entry.subZones[0]!.tiles)) !== null;
  if (simple) {
    return `    { team: ${teamConst(entry.team)}, subZones: [{ tiles: ${tilesExpr(entry.subZones[0]!, '')} }] },`;
  }
  const lines: string[] = [];
  lines.push('    {');
  lines.push(`      team: ${teamConst(entry.team)},`);
  lines.push('      subZones: [');
  for (const sub of entry.subZones) {
    lines.push('        {');
    if (sub.cap !== undefined) lines.push(`          cap: ${sub.cap},`);
    lines.push(`          tiles: ${tilesExpr(sub, '          ')},`);
    lines.push('        },');
  }
  lines.push('      ],');
  lines.push('    },');
  return lines.join('\n');
}

// The registry object key for a config name: bare identifier when legal,
// quoted otherwise.
const configKey = (name: string): string =>
  /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : quote(name);

// The generated src/content/deployment/registry.ts.
export function generateZoneRegistryModule(registry: ReadonlyArray<MapZoneEntry>): string {
  const constNames = new Map<string, Map<string, string>>();
  const configBlocks: string[] = [];
  for (const entry of registry) {
    const perConfig = new Map<string, string>();
    constNames.set(entry.mapKey, perConfig);
    for (const config of entry.configs) {
      const constName = `${camelKey(entry.mapKey)}${pascal(config.name)}`;
      perConfig.set(config.name, constName);
      const teams = config.teams.map(teamLines).join('\n');
      configBlocks.push(
        `// ${entry.mapKey} — ${quote(config.name)}.\nconst ${constName}: DeploymentZoneConfig = {\n  teams: [\n${teams}\n  ],\n};`,
      );
    }
  }

  const registryEntries = registry
    .map((entry) => {
      const perConfig = constNames.get(entry.mapKey)!;
      const configs = entry.configs
        .map((c) => `${configKey(c.name)}: ${perConfig.get(c.name)!}`)
        .join(', ');
      return `  ${entry.mapKey}: { ${configs} },`;
    })
    .join('\n');

  return `${ZONE_MODULE_HEADER}
import { teamId, type DeploymentZoneConfig } from '@engine/index.ts';
import { rect } from './zone-helpers.ts';

const TEAM_BLUE = teamId('team_a');
const TEAM_RED = teamId('team_b');

${configBlocks.join('\n\n')}

// mapKey → (configName → config). 'default' is the convention every map
// provides; further keys are alternate layouts on the same terrain.
export const DEPLOYMENT_ZONE_REGISTRY: Readonly<
  Record<string, Readonly<Record<string, DeploymentZoneConfig>>>
> = {
${registryEntries}
};

// Look up a map's deployment-zone config by name (defaults to 'default').
// Throws loud on an unknown map or config — a missing config is a content
// wiring bug, not a silent fallback.
export function deploymentZonesFor(
  mapKey: string,
  configName = 'default',
): DeploymentZoneConfig {
  const configs = DEPLOYMENT_ZONE_REGISTRY[mapKey];
  if (configs === undefined) {
    throw new Error(
      \`deploymentZonesFor: no deployment-zone configs registered for map '\${mapKey}'.\`,
    );
  }
  const config = configs[configName];
  if (config === undefined) {
    throw new Error(
      \`deploymentZonesFor: map '\${mapKey}' has no deployment-zone config named '\${configName}'.\`,
    );
  }
  return config;
}
`;
}

// ---------------------------------------------------------------------------
// Battle-lineup module (Tier 2 — the unit mode)
// ---------------------------------------------------------------------------

const LINEUP_MODULE_HEADER = `// GENERATED-SHAPED — battle-lineup module (Cartographer unit mode).
//
// This module is codegen output of the Cartographer map-authoring tool (the
// \`?cartographer\` dev route): the lineup's spec — ordered player staging,
// guest markers, and enemy slots, each with position + facing (enemy slots
// also carry an authored class + level) — plus the BattleConfig restaged
// from it. ENEMY SLOT ORDER IS MEANINGFUL (lead = slot 0; the campaign fold
// re-skins by index). The authored classes/levels are consumed campaign-side
// via \`enemiesFromLineup\` (src/campaign/lineup.ts). Hand edits are legal
// TypeScript but the next Cartographer export of this lineup OVERWRITES THE
// FILE WHOLESALE. Round-trip fidelity is pinned by the Cartographer codegen
// test.
`;

// The six hand-written Mage War battle files stay hand-written (Chris's S98
// call); river_ridge is doubly off-limits — it IS the base config a lineup
// module spreads, so a generated file at its key would import itself.
// Exported so validation can gate Export instead of letting the overlay
// throw mid-render.
export const RESERVED_LINEUP_KEYS: ReadonlySet<string> = new Set(['river_ridge']);

const slotLine = (s: { x: number; y: number; layer: number; facing: string }): string =>
  `    { x: ${s.x}, y: ${s.y}, layer: ${s.layer}, facing: ${quote(s.facing)} },`;

// The generated src/content/battles/<slug>-battle.ts.
export function generateLineupModule(spec: LineupSpec): string {
  assertKey(spec.mapKey);
  const PREFIX = constPrefix(spec.key);
  const camel = camelKey(spec.key);
  const mapCamel = camelKey(spec.mapKey);
  if (RESERVED_LINEUP_KEYS.has(spec.key)) {
    throw new Error(
      `cartographer codegen: '${spec.key}' is the hand-written base battle — a generated lineup cannot take its key`,
    );
  }

  const list = (
    label: 'players' | 'guests',
    slots: ReadonlyArray<{ x: number; y: number; layer: number; facing: string }>,
  ): string =>
    slots.length === 0
      ? `  ${label}: [],`
      : `  ${label}: [\n${slots.map(slotLine).join('\n')}\n  ],`;

  const enemyLines = spec.enemies.map(emitEnemySlot).join('\n');
  const enemiesExpr =
    spec.enemies.length === 0 ? '  enemies: [],' : `  enemies: [\n${enemyLines}\n  ],`;

  return `${LINEUP_MODULE_HEADER}
import type { BattleConfig } from '@engine/index.ts';

import { buildBattleFromLineup, type LineupSpec } from '@content/battles/lineup-format.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { ${mapCamel} } from '@content/maps/${docSlug(spec.mapKey)}.ts';

// Lineup '${spec.key}' on map '${spec.mapKey}' — battle id '${spec.battleId}'.
export const ${PREFIX}_LINEUP: LineupSpec = {
  key: ${quote(spec.key)},
  mapKey: ${quote(spec.mapKey)},
  battleId: ${quote(spec.battleId)},
${list('players', spec.players)}
${list('guests', spec.guests)}
${enemiesExpr}
};

export const ${camel}Battle: BattleConfig = buildBattleFromLineup(
  ${PREFIX}_LINEUP,
  ${mapCamel},
  riverRidgeBattle,
);
`;
}

// One enemy slot: single-line without overrides, expanded with them.
// Override fields emit in a FIXED order and only when authored — the
// canonical shape the round-trip fixture pins.
function emitEnemySlot(e: {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly facing: string;
  readonly classId: string;
  readonly level: number;
  readonly overrides?: {
    readonly name?: string;
    readonly brave?: number;
    readonly faith?: number;
    readonly gender?: string;
    readonly jpBudget?: number;
    readonly unlocks?: ReadonlyArray<{ readonly kind: string; readonly id: string }>;
    readonly secondaryCommandSet?: string;
    readonly passives?: Readonly<Record<string, ReadonlyArray<string> | undefined>>;
    readonly equipment?: Readonly<Record<string, string | undefined>>;
  };
}): string {
  const head = `x: ${e.x}, y: ${e.y}, layer: ${e.layer}, facing: ${quote(e.facing)}, classId: ${quote(e.classId)}, level: ${e.level}`;
  const o = e.overrides;
  if (o === undefined) return `    { ${head} },`;

  const lines: string[] = [];
  if (o.name !== undefined) lines.push(`        name: ${quote(o.name)},`);
  if (o.brave !== undefined) lines.push(`        brave: ${o.brave},`);
  if (o.faith !== undefined) lines.push(`        faith: ${o.faith},`);
  if (o.gender !== undefined) lines.push(`        gender: ${quote(o.gender)},`);
  if (o.jpBudget !== undefined) lines.push(`        jpBudget: ${o.jpBudget},`);
  if (o.unlocks !== undefined) {
    if (o.unlocks.length === 0) {
      lines.push('        unlocks: [],');
    } else {
      lines.push('        unlocks: [');
      for (const u of o.unlocks) {
        lines.push(`          { kind: ${quote(u.kind)}, id: ${quote(u.id)} },`);
      }
      lines.push('        ],');
    }
  }
  if (o.secondaryCommandSet !== undefined) {
    lines.push(`        secondaryCommandSet: ${quote(o.secondaryCommandSet)},`);
  }
  if (o.passives !== undefined) {
    const buckets = (['reaction', 'support', 'movement'] as const)
      .filter((b) => (o.passives?.[b]?.length ?? 0) > 0)
      .map((b) => `${b}: [${o.passives![b]!.map(quote).join(', ')}]`);
    if (buckets.length > 0) lines.push(`        passives: { ${buckets.join(', ')} },`);
  }
  if (o.equipment !== undefined) {
    const slots = (['leftHand', 'rightHand', 'headgear', 'armor', 'accessory'] as const)
      .filter((s) => o.equipment?.[s] !== undefined)
      .map((s) => `${s}: ${quote(o.equipment![s]!)}`);
    lines.push(`        equipment: { ${slots.join(', ')} },`);
  }

  if (lines.length === 0) return `    { ${head} },`;
  return [
    '    {',
    `      ${head},`,
    '      overrides: {',
    ...lines,
    '      },',
    '    },',
  ].join('\n');
}
