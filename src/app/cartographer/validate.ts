// Cartographer — live validation. Reuses the ENGINE validators verbatim
// (validateMap terrain geometry incl. the multi-layer bridge rules;
// validateDeploymentZones vs the deployable count) — the tool adds no
// rules of its own except the CONNECTIVITY ADVISORY, which is
// deliberately a warning: the engine has no reachability rule because
// authored-unreachable terrain is legitimate (Alvera's building walls),
// but a fully cut-off enemy deployment zone is almost always an authoring
// mistake worth flagging before a playtest finds it.

import {
  teamId,
  validateDeploymentZones,
  validateMap,
  type DeploymentZoneConfig,
  type TeamId,
} from '@engine/index.ts';
import { defaultRuleset } from '@content/rulesets/default.ts';
import { buildMapFromSpec } from '@content/maps/map-format.ts';
import type { CartographerModel, ZoneConfig } from './model.ts';
import { defaultZoneConfig } from './edit.ts';

export interface CartographerFinding {
  readonly level: 'error' | 'warn';
  readonly message: string;
}

// The elevation step the connectivity advisory assumes crossable — a
// generous "some class can jump this" figure, not a per-class truth.
const ADVISORY_MAX_STEP = 2;

export function zoneConfigToEngine(config: ZoneConfig): DeploymentZoneConfig {
  return {
    teams: config.teams.map((t) => ({
      team: teamId(t.team),
      subZones: t.subZones.map((s) => ({
        ...(s.cap !== undefined ? { cap: s.cap } : {}),
        tiles: s.tiles.map((p) => ({ x: p.x, y: p.y, layer: p.layer })),
      })),
    })),
  };
}

export function validateModel(
  model: CartographerModel,
  deployCount: number,
): ReadonlyArray<CartographerFinding> {
  const findings: CartographerFinding[] = [];

  if (!/^[a-z][a-z0-9_]*$/.test(model.spec.key)) {
    findings.push({
      level: 'error',
      message: `map key '${model.spec.key}' must be snake_case ([a-z][a-z0-9_]*)`,
    });
    return findings; // codegen and identifier derivation both need the key
  }

  let map;
  try {
    map = buildMapFromSpec(model.spec);
  } catch (e) {
    findings.push({ level: 'error', message: `spec does not build: ${String(e)}` });
    return findings;
  }

  const terrainResult = validateMap(map, defaultRuleset.terrain.tags);
  for (const err of terrainResult.errors) {
    findings.push({ level: 'error', message: `map: ${err.message}` });
  }

  const config = defaultZoneConfig(model);
  if (config === undefined) {
    findings.push({
      level: 'error',
      message: `no 'default' deployment-zone config — paint player and enemy zones`,
    });
    return findings;
  }
  const required = new Map<TeamId, number>([
    [teamId('team_a'), deployCount],
    [teamId('team_b'), deployCount],
  ]);
  const zoneResult = validateDeploymentZones(zoneConfigToEngine(config), map, {
    requiredZonesPerTeam: required,
  });
  for (const err of zoneResult.errors) {
    findings.push({ level: 'error', message: `zones: ${err.message}` });
  }

  if (terrainResult.ok && zoneResult.ok) {
    findings.push(...connectivityAdvisory(model, config));
  }
  return findings;
}

// BFS over 4-adjacency from the player (team_a) zone, crossing steps of
// ≤ ADVISORY_MAX_STEP between standable surfaces (either layer of a
// stacked cell). Warns on unreachable enemy-zone tiles.
function connectivityAdvisory(
  model: CartographerModel,
  config: ZoneConfig,
): CartographerFinding[] {
  const spec = model.spec;
  const surfaces = new Map<string, number[]>(); // "x,y" → elevations (ground, deck?)
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      surfaces.set(`${x},${y}`, [spec.elevation[y]![x]!]);
    }
  }
  for (const d of spec.decks) surfaces.get(`${d.x},${d.y}`)?.push(d.elevation);

  const playerTiles =
    config.teams.find((t) => t.team === 'team_a')?.subZones.flatMap((s) => s.tiles) ?? [];
  const enemyTiles =
    config.teams.find((t) => t.team === 'team_b')?.subZones.flatMap((s) => s.tiles) ?? [];
  if (playerTiles.length === 0 || enemyTiles.length === 0) return [];

  // Node = surface (x, y, elevationIndex). Seed with the player tiles'
  // layer-0 surface.
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; elev: number }> = [];
  for (const t of playerTiles) {
    const elev = surfaces.get(`${t.x},${t.y}`)?.[0];
    if (elev !== undefined) {
      const key = `${t.x},${t.y},${elev}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: t.x, y: t.y, elev });
      }
    }
  }
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      for (const elev of surfaces.get(`${nx},${ny}`) ?? []) {
        if (Math.abs(elev - cur.elev) > ADVISORY_MAX_STEP) continue;
        const key = `${nx},${ny},${elev}`;
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, elev });
      }
    }
  }

  const cutOff = enemyTiles.filter((t) => {
    const elev = surfaces.get(`${t.x},${t.y}`)?.[0];
    return elev === undefined || !visited.has(`${t.x},${t.y},${elev}`);
  });
  if (cutOff.length === 0) return [];
  const sample = cutOff
    .slice(0, 3)
    .map((t) => `(${t.x},${t.y})`)
    .join(' ');
  return [
    {
      level: 'warn',
      message:
        `connectivity (advisory, ≤${ADVISORY_MAX_STEP} step): ${cutOff.length} enemy-zone ` +
        `tile${cutOff.length === 1 ? '' : 's'} unreachable from the player zone — ${sample}${cutOff.length > 3 ? ' …' : ''}`,
    },
  ];
}
