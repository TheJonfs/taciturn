// Deployment-zone accessors + validation + the terrain↔zones combiner.
//
// Session 70: zones live beside the terrain now (see
// `engine/types/deployment-zone.ts`). These pure helpers are the single
// vocabulary every consumer (AI deployment, the deployment-phase UI, the
// renderer tint, the validator) reads through, replacing the old
// `tile.deploymentZone` field reads.

import type { Position } from '../types/spatial.ts';
import type { TeamId } from '../types/ids.ts';
import type {
  DeploymentZoneConfig,
  TeamDeploymentZone,
} from '../types/deployment-zone.ts';
import type { BattleMap } from '../types/tile.ts';

// Same grid cell? (x, y, layer all equal.)
function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}

// The side's region, or undefined if the config has no entry for `team`.
export function zoneForTeam(
  config: DeploymentZoneConfig,
  team: TeamId,
): TeamDeploymentZone | undefined {
  return config.teams.find((z) => z.team === team);
}

// Every tile a team may deploy onto (its sub-zones flattened). Order is
// sub-zone order then within-sub-zone order — deterministic for the AI's
// downstream sort. Empty if the team has no zone.
export function tilesForTeam(
  config: DeploymentZoneConfig,
  team: TeamId,
): ReadonlyArray<Position> {
  const zone = zoneForTeam(config, team);
  if (zone === undefined) return [];
  return zone.subZones.flatMap((sz) => sz.tiles);
}

// Every tile owned by some team *other* than `team` (the AI's
// opposing-centroid input). `null`-team sub-zones don't exist in the
// model (unlike the old tile field's `null` neutral); every sub-zone
// belongs to a concrete team.
export function opposingTilesFor(
  config: DeploymentZoneConfig,
  team: TeamId,
): ReadonlyArray<Position> {
  return config.teams
    .filter((z) => z.team !== team)
    .flatMap((z) => z.subZones.flatMap((sz) => sz.tiles));
}

// Which team (if any) owns `pos`. Used by the renderer tint and the UI
// eligibility check. Returns the first owning team — configs must not
// overlap a tile across teams (the validator rejects that).
export function teamForTile(
  config: DeploymentZoneConfig,
  pos: Position,
): TeamId | undefined {
  for (const zone of config.teams) {
    for (const sz of zone.subZones) {
      if (sz.tiles.some((t) => samePosition(t, pos))) return zone.team;
    }
  }
  return undefined;
}

// Is `pos` an eligible deployment tile for `team`? The UI click-
// eligibility test (replaces `tile.deploymentZone === currentTeam`).
export function isTileInTeamZone(
  config: DeploymentZoneConfig,
  team: TeamId,
  pos: Position,
): boolean {
  return teamForTile(config, pos) === team;
}

// The index of the sub-zone (within `team`'s zone) that contains `pos`,
// or null if none. Cap enforcement keys off this — a placement counts
// against the sub-zone it lands in.
export function subZoneIndexForTile(
  config: DeploymentZoneConfig,
  team: TeamId,
  pos: Position,
): number | null {
  const zone = zoneForTeam(config, team);
  if (zone === undefined) return null;
  for (let i = 0; i < zone.subZones.length; i++) {
    if (zone.subZones[i]!.tiles.some((t) => samePosition(t, pos))) return i;
  }
  return null;
}

// ===== Validation =====

export interface DeploymentZoneValidationError {
  readonly code:
    | 'unknown_deployment_team'
    | 'missing_deployment_zone'
    | 'insufficient_deployment_zone'
    | 'zone_tile_out_of_bounds'
    | 'zone_tile_not_on_map'
    | 'overlapping_zone_tile';
  readonly message: string;
}

export interface DeploymentZoneValidationResult {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<DeploymentZoneValidationError>;
}

export interface DeploymentZoneValidationOptions {
  // Each team that must have a deployment zone, paired with the minimum
  // tile count required (typically the team's roster size). Mirrors the
  // old `validateMap` zone-coverage check.
  readonly requiredZonesPerTeam: ReadonlyMap<TeamId, number>;
}

function posKey(p: Position): string {
  return `${p.x},${p.y},${p.layer}`;
}

// Validate a zone config against the terrain it'll be paired with:
//   - every zone tile is in bounds and exists on the terrain,
//   - no tile is claimed by two sides (or twice),
//   - each required team has enough zone tiles.
// Pure; mirrors `validateMap`'s structured-error shape.
export function validateDeploymentZones(
  config: DeploymentZoneConfig,
  terrain: BattleMap,
  options: DeploymentZoneValidationOptions,
): DeploymentZoneValidationResult {
  const errors: DeploymentZoneValidationError[] = [];

  const terrainPositions = new Set(terrain.tiles.map(posKey));
  const claimedBy = new Map<string, TeamId>();
  const tileCounts = new Map<TeamId, number>();

  for (const zone of config.teams) {
    if (!options.requiredZonesPerTeam.has(zone.team)) {
      errors.push({
        code: 'unknown_deployment_team',
        message: `Deployment zone declares unknown team '${zone.team}'.`,
      });
    }
    for (const sz of zone.subZones) {
      for (const tile of sz.tiles) {
        if (
          tile.x < 0 ||
          tile.y < 0 ||
          tile.x >= terrain.width ||
          tile.y >= terrain.height
        ) {
          errors.push({
            code: 'zone_tile_out_of_bounds',
            message: `Zone tile (${tile.x}, ${tile.y}, layer ${tile.layer}) for team '${zone.team}' is outside map bounds (${terrain.width}×${terrain.height}).`,
          });
          continue;
        }
        const key = posKey(tile);
        if (!terrainPositions.has(key)) {
          errors.push({
            code: 'zone_tile_not_on_map',
            message: `Zone tile (${tile.x}, ${tile.y}, layer ${tile.layer}) for team '${zone.team}' has no matching terrain tile.`,
          });
        }
        const existing = claimedBy.get(key);
        if (existing !== undefined) {
          errors.push({
            code: 'overlapping_zone_tile',
            message: `Zone tile (${tile.x}, ${tile.y}, layer ${tile.layer}) is claimed by both '${existing}' and '${zone.team}'.`,
          });
        } else {
          claimedBy.set(key, zone.team);
        }
        tileCounts.set(zone.team, (tileCounts.get(zone.team) ?? 0) + 1);
      }
    }
  }

  for (const [team, required] of options.requiredZonesPerTeam) {
    const count = tileCounts.get(team) ?? 0;
    if (count === 0) {
      errors.push({
        code: 'missing_deployment_zone',
        message: `No deployment-zone tiles for team '${team}'.`,
      });
    } else if (count < required) {
      errors.push({
        code: 'insufficient_deployment_zone',
        message: `Team '${team}' has only ${count} deployment-zone tile${count === 1 ? '' : 's'}; config requires ${required}.`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// ===== Combiner =====

// A terrain paired with a chosen deployment-zone config — the deployment-
// ready battlefield. This is the seam: one terrain + one zone-config →
// one assembled battlefield. It stays a *plain assembler* — no party,
// reward, objective, or config-selection concerns accrete here (those are
// campaign work). Validation is the caller's call: `assembleBattlefield`
// pairs; `validateDeploymentZones` checks.
export interface DeployableBattlefield {
  readonly terrain: BattleMap;
  readonly zones: DeploymentZoneConfig;
}

export function assembleBattlefield(
  terrain: BattleMap,
  zones: DeploymentZoneConfig,
): DeployableBattlefield {
  return { terrain, zones };
}
