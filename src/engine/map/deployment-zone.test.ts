import { describe, expect, it } from 'vitest';
import {
  assembleBattlefield,
  isTileInTeamZone,
  opposingTilesFor,
  subZoneIndexForTile,
  teamForTile,
  tilesForTeam,
  validateDeploymentZones,
  zoneForTeam,
} from './deployment-zone.ts';
import { mapWith } from './test-fixtures.ts';
import { teamId, type DeploymentZoneConfig, type TeamId } from '../types/index.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

// A 4×4 ground terrain to validate zone configs against.
function groundTerrain(w = 4, h = 4) {
  const tiles: Array<{ x: number; y: number; terrain: string; elevation: number }> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) tiles.push({ x, y, terrain: 'ground', elevation: 2 });
  }
  return mapWith({ width: w, height: h, tiles });
}

// Single sub-zone per team: A at (0,0)/(1,0), B at (2,3)/(3,3).
const simpleConfig: DeploymentZoneConfig = {
  teams: [
    { team: TEAM_A, subZones: [{ tiles: [{ x: 0, y: 0, layer: 0 }, { x: 1, y: 0, layer: 0 }] }] },
    { team: TEAM_B, subZones: [{ tiles: [{ x: 2, y: 3, layer: 0 }, { x: 3, y: 3, layer: 0 }] }] },
  ],
};

// Split zone: A across two disjoint sub-zones with caps.
const splitConfig: DeploymentZoneConfig = {
  teams: [
    {
      team: TEAM_A,
      subZones: [
        { tiles: [{ x: 0, y: 0, layer: 0 }, { x: 1, y: 0, layer: 0 }], cap: 1 },
        { tiles: [{ x: 3, y: 0, layer: 0 }], cap: 2 },
      ],
    },
    { team: TEAM_B, subZones: [{ tiles: [{ x: 0, y: 3, layer: 0 }] }] },
  ],
};

function requireZones(perTeam: ReadonlyArray<[TeamId, number]>): ReadonlyMap<TeamId, number> {
  return new Map(perTeam);
}

describe('deployment-zone accessors', () => {
  it('zoneForTeam returns the side, or undefined', () => {
    expect(zoneForTeam(simpleConfig, TEAM_A)?.team).toBe(TEAM_A);
    expect(zoneForTeam(simpleConfig, teamId('nobody'))).toBeUndefined();
  });

  it('tilesForTeam flattens all sub-zones in order', () => {
    expect(tilesForTeam(splitConfig, TEAM_A)).toEqual([
      { x: 0, y: 0, layer: 0 },
      { x: 1, y: 0, layer: 0 },
      { x: 3, y: 0, layer: 0 },
    ]);
  });

  it('opposingTilesFor returns the other team(s) tiles', () => {
    expect(opposingTilesFor(simpleConfig, TEAM_A)).toEqual([
      { x: 2, y: 3, layer: 0 },
      { x: 3, y: 3, layer: 0 },
    ]);
  });

  it('teamForTile / isTileInTeamZone resolve ownership', () => {
    expect(teamForTile(simpleConfig, { x: 0, y: 0, layer: 0 })).toBe(TEAM_A);
    expect(teamForTile(simpleConfig, { x: 2, y: 3, layer: 0 })).toBe(TEAM_B);
    expect(teamForTile(simpleConfig, { x: 2, y: 2, layer: 0 })).toBeUndefined();
    expect(isTileInTeamZone(simpleConfig, TEAM_A, { x: 0, y: 0, layer: 0 })).toBe(true);
    expect(isTileInTeamZone(simpleConfig, TEAM_A, { x: 2, y: 3, layer: 0 })).toBe(false);
  });

  it('subZoneIndexForTile keys a tile to its sub-zone', () => {
    expect(subZoneIndexForTile(splitConfig, TEAM_A, { x: 1, y: 0, layer: 0 })).toBe(0);
    expect(subZoneIndexForTile(splitConfig, TEAM_A, { x: 3, y: 0, layer: 0 })).toBe(1);
    expect(subZoneIndexForTile(splitConfig, TEAM_A, { x: 2, y: 2, layer: 0 })).toBeNull();
  });
});

describe('validateDeploymentZones', () => {
  const terrain = groundTerrain();

  it('accepts a clean config meeting the required counts', () => {
    const result = validateDeploymentZones(simpleConfig, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 2], [TEAM_B, 2]]),
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an unknown team', () => {
    const config: DeploymentZoneConfig = {
      teams: [{ team: teamId('phantom'), subZones: [{ tiles: [{ x: 0, y: 0, layer: 0 }] }] }],
    };
    const result = validateDeploymentZones(config, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 1], [TEAM_B, 1]]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_deployment_team')).toBe(true);
    expect(result.errors.some((e) => e.code === 'missing_deployment_zone')).toBe(true);
  });

  it('rejects insufficient zone tiles for a required team', () => {
    const result = validateDeploymentZones(simpleConfig, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 2], [TEAM_B, 3]]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'insufficient_deployment_zone')).toBe(true);
  });

  it('rejects a zone tile with no matching terrain tile', () => {
    const config: DeploymentZoneConfig = {
      teams: [{ team: TEAM_A, subZones: [{ tiles: [{ x: 0, y: 0, layer: 9 }] }] }],
    };
    const result = validateDeploymentZones(config, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 1]]),
    });
    expect(result.errors.some((e) => e.code === 'zone_tile_not_on_map')).toBe(true);
  });

  it('rejects an out-of-bounds zone tile', () => {
    const config: DeploymentZoneConfig = {
      teams: [{ team: TEAM_A, subZones: [{ tiles: [{ x: 99, y: 0, layer: 0 }] }] }],
    };
    const result = validateDeploymentZones(config, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 1]]),
    });
    expect(result.errors.some((e) => e.code === 'zone_tile_out_of_bounds')).toBe(true);
  });

  it('rejects a tile claimed by two teams', () => {
    const config: DeploymentZoneConfig = {
      teams: [
        { team: TEAM_A, subZones: [{ tiles: [{ x: 0, y: 0, layer: 0 }] }] },
        { team: TEAM_B, subZones: [{ tiles: [{ x: 0, y: 0, layer: 0 }] }] },
      ],
    };
    const result = validateDeploymentZones(config, terrain, {
      requiredZonesPerTeam: requireZones([[TEAM_A, 1], [TEAM_B, 1]]),
    });
    expect(result.errors.some((e) => e.code === 'overlapping_zone_tile')).toBe(true);
  });
});

describe('assembleBattlefield', () => {
  it('pairs terrain and zones without mutation', () => {
    const terrain = groundTerrain();
    const battlefield = assembleBattlefield(terrain, simpleConfig);
    expect(battlefield.terrain).toBe(terrain);
    expect(battlefield.zones).toBe(simpleConfig);
  });
});
