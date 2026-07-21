// Cartographer — live validation. Reuses the ENGINE validators verbatim
// (validateMap terrain geometry incl. the multi-layer bridge rules;
// validateDeploymentZones vs the deployable count) — the tool adds no
// rules of its own except the CONNECTIVITY ADVISORY, which is
// deliberately a warning: the engine has no reachability rule because
// authored-unreachable terrain is legitimate (Alvera's building walls),
// but a fully cut-off enemy deployment zone is almost always an authoring
// mistake worth flagging before a playtest finds it.

import {
  abilityId,
  classId,
  commandSetId,
  itemId,
  teamId,
  validateDeploymentZones,
  validateDraftUnit,
  validateMap,
  type DeploymentZoneConfig,
  type TeamId,
} from '@engine/index.ts';
import { defaultRuleset } from '@content/rulesets/default.ts';
import { buildMapFromSpec } from '@content/maps/map-format.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  COMPONENT_ENTRIES,
  composeLineupEnemyDraft,
  tokenKey,
  unlockRefToToken,
} from '@campaign/index.ts';
import type { EnemyLineupSlot } from '@content/battles/lineup-format.ts';
import type { CartographerModel, ZoneConfig } from './model.ts';
import { RESERVED_LINEUP_KEYS } from './codegen.ts';
import { defaultZoneConfig, zoneMembership } from './edit.ts';

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
  findings.push(...lineupFindings(model, config));
  return findings;
}

// The base config a generated lineup module spreads — its player-fixture
// count is the staging count every lineup must author.
const BASE_PLAYER_COUNT = riverRidgeBattle.units.filter(
  (u) => u.team === riverRidgeBattle.teams[0]!.id && u.guest !== true,
).length;

let catalogSingleton: ReturnType<typeof loadDefaultCatalog> | null = null;
const catalog = (): ReturnType<typeof loadDefaultCatalog> =>
  (catalogSingleton ??= loadDefaultCatalog());

// Lineup checks (Tier 2). Errors gate export like everything else; the
// zone-adjacency checks are warnings (staging outside the player zone is
// odd but legal — deployment overrides player positions anyway).
function lineupFindings(
  model: CartographerModel,
  config: ZoneConfig | undefined,
): CartographerFinding[] {
  const lineup = model.lineup;
  if (lineup === null) return [];
  const findings: CartographerFinding[] = [];
  const spec = model.spec;

  if (RESERVED_LINEUP_KEYS.has(spec.key)) {
    findings.push({
      level: 'error',
      message:
        `lineup: '${spec.key}' is the hand-written base battle every lineup spreads — ` +
        `rename the map key (save-as) to export a lineup here`,
    });
  }
  if (!/^[a-z][a-z0-9_]*$/.test(lineup.battleId)) {
    findings.push({
      level: 'error',
      message: `lineup: battle id '${lineup.battleId}' must be snake_case`,
    });
  }
  if (lineup.players.length !== BASE_PLAYER_COUNT) {
    findings.push({
      level: 'error',
      message: `lineup: ${lineup.players.length}/${BASE_PLAYER_COUNT} player staging slots placed`,
    });
  }
  if (lineup.enemies.length === 0) {
    findings.push({ level: 'error', message: 'lineup: no enemy slots placed' });
  }

  const all = [
    ...lineup.players.map((s) => ({ ...s, what: 'player slot' })),
    ...lineup.guests.map((s) => ({ ...s, what: 'guest slot' })),
    ...lineup.enemies.map((s) => ({ ...s, what: 'enemy slot' })),
  ];
  const seen = new Set<string>();
  for (const s of all) {
    const key = `${s.x},${s.y}`;
    if (seen.has(key)) {
      findings.push({ level: 'error', message: `lineup: two units share tile (${s.x},${s.y})` });
    }
    seen.add(key);
    if (s.x < 0 || s.x >= spec.width || s.y < 0 || s.y >= spec.height) {
      findings.push({
        level: 'error',
        message: `lineup: ${s.what} (${s.x},${s.y}) is out of bounds`,
      });
    } else if (s.layer === 1 && !spec.decks.some((d) => d.x === s.x && d.y === s.y)) {
      findings.push({
        level: 'error',
        message: `lineup: ${s.what} (${s.x},${s.y}) stands on layer 1 but the tile has no deck`,
      });
    }
  }

  for (const e of lineup.enemies) {
    if (!catalog().hasClass(classId(e.classId))) {
      findings.push({ level: 'error', message: `lineup: unknown class '${e.classId}'` });
      continue;
    }
    if (!Number.isInteger(e.level) || e.level < 1 || e.level > 50) {
      findings.push({
        level: 'error',
        message: `lineup: enemy at (${e.x},${e.y}) has level ${e.level} (expected 1-50)`,
      });
    }
    const zone = config !== undefined ? zoneMembership(config, e.x, e.y) : undefined;
    if (zone?.team === 'team_a') {
      findings.push({
        level: 'warn',
        message: `lineup: enemy at (${e.x},${e.y}) stands inside the player deployment zone`,
      });
    }
    findings.push(...overrideFindings(e));
  }
  return findings;
}

// The catalog's components keyed for membership checks: known tokens, and
// which of them are unit-restricted (signature components — never on
// tool-authored generics; hand-authored specs are the path).
let componentKeysSingleton: { known: Set<string>; restricted: Set<string> } | null = null;
const componentKeys = (): { known: Set<string>; restricted: Set<string> } => {
  if (componentKeysSingleton === null) {
    const known = new Set<string>();
    const restricted = new Set<string>();
    for (const meta of COMPONENT_ENTRIES) {
      known.add(tokenKey(meta.token));
      if (meta.restrictedToUnit !== undefined) restricted.add(tokenKey(meta.token));
    }
    componentKeysSingleton = { known, restricted };
  }
  return componentKeysSingleton;
};

// Per-enemy override checks (Tier 3). The load-bearing one is the LAST: the
// composed loadout + equipment run through the engine's draft-legality
// resolver — the same check createInitialState enforces — so an illegal
// authored build fails HERE, gating export, instead of at battle time.
function overrideFindings(e: EnemyLineupSlot): CartographerFinding[] {
  const o = e.overrides;
  if (o === undefined) return [];
  const findings: CartographerFinding[] = [];
  const at = `enemy at (${e.x},${e.y})`;
  const cat = catalog();

  for (const stat of ['brave', 'faith'] as const) {
    const v = o[stat];
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > 100)) {
      findings.push({ level: 'error', message: `lineup: ${at} has ${stat} ${v} (expected 1-100)` });
    }
  }
  if (o.jpBudget !== undefined && (o.jpBudget < 0 || !Number.isFinite(o.jpBudget))) {
    findings.push({ level: 'error', message: `lineup: ${at} has a negative JP budget` });
  }
  for (const ref of o.unlocks ?? []) {
    const key = tokenKey(unlockRefToToken(ref));
    if (!componentKeys().known.has(key)) {
      findings.push({ level: 'error', message: `lineup: ${at} unlocks unknown component '${key}'` });
    } else if (componentKeys().restricted.has(key)) {
      findings.push({
        level: 'error',
        message: `lineup: ${at} unlocks '${key}' — unit-restricted signature components stay hand-authored`,
      });
    }
  }
  if (
    o.secondaryCommandSet !== undefined &&
    !cat.hasCommandSet(commandSetId(o.secondaryCommandSet))
  ) {
    findings.push({
      level: 'error',
      message: `lineup: ${at} has unknown secondary command set '${o.secondaryCommandSet}'`,
    });
  }
  for (const bucket of ['reaction', 'support', 'movement'] as const) {
    for (const id of o.passives?.[bucket] ?? []) {
      if (!cat.hasAbility(abilityId(id))) {
        findings.push({
          level: 'error',
          message: `lineup: ${at} equips unknown ${bucket} passive '${id}'`,
        });
      } else if (cat.getAbility(abilityId(id)).kind !== 'passive') {
        findings.push({
          level: 'error',
          message: `lineup: ${at} — '${id}' is not a passive (${bucket} bucket)`,
        });
      }
    }
  }
  for (const [slot, id] of Object.entries(o.equipment ?? {})) {
    if (id !== undefined && !cat.hasItem(itemId(id))) {
      findings.push({ level: 'error', message: `lineup: ${at} equips unknown item '${id}' (${slot})` });
    }
  }
  if (findings.length > 0) return findings; // composition below needs resolvable ids

  // Compose exactly what the fold will ship and run the engine's
  // draft-legality resolver — the same rules createInitialState enforces.
  try {
    const draft = composeLineupEnemyDraft(e, cat);
    const legality = validateDraftUnit(
      { classId: classId(e.classId), loadout: draft.loadout, equipment: draft.equipment },
      cat,
      riverRidgeBattle.rulesetId,
    );
    for (const bad of legality.invalidSlots) {
      findings.push({
        level: 'error',
        message: `lineup: ${at} — illegal ${bad.slot} '${String(bad.itemId)}': ${bad.reason}`,
      });
    }
    for (const over of legality.bucketOverages) {
      findings.push({
        level: 'error',
        message:
          `lineup: ${at} — ${String(over.bucketId)} over capacity ` +
          `(${over.used}/${over.capacity})`,
      });
    }
    for (const hand of legality.twoHandedConflictHands) {
      findings.push({
        level: 'error',
        message: `lineup: ${at} — two-handed grip conflict in ${hand}`,
      });
    }
    if (legality.dualWielding) {
      // UI-tier rule, same as Team Builder/Formation: dual wield needs the
      // granting passive (createInitialState tolerates, but the tool blocks).
      findings.push({
        level: 'error',
        message: `lineup: ${at} — dual-wielding without a dual-wield passive`,
      });
    }
    for (const conflict of legality.equipLegalityConflicts) {
      findings.push({
        level: 'error',
        message: `lineup: ${at} — equip-legality conflict: ${JSON.stringify(conflict)}`,
      });
    }
  } catch (err) {
    findings.push({ level: 'error', message: `lineup: ${at} — ${String(err)}` });
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
