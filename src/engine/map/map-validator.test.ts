import { describe, expect, it } from 'vitest';
import { assertMapValid, MapValidationError_Throw, validateMap } from './map-validator.ts';
import { mapFrom, mapWith, type TileSpec } from './test-fixtures.ts';
import type { TerrainRegistry } from './terrain-registry.ts';
import { teamId, type BattleMap, type TeamId } from '../types/index.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
]);

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');

function requireZones(perTeam: ReadonlyArray<[TeamId, number]>): ReadonlyMap<TeamId, number> {
  return new Map(perTeam);
}

function mapWithZones(): BattleMap {
  // 4×4 ground map with two zone tiles per team.
  const tiles: TileSpec[] = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const zone =
        y === 0 && (x === 0 || x === 1)
          ? TEAM_A
          : y === 3 && (x === 2 || x === 3)
            ? TEAM_B
            : undefined;
      tiles.push(
        zone === undefined
          ? { x, y, terrain: 'ground', elevation: 2 }
          : { x, y, terrain: 'ground', elevation: 2, deploymentZone: zone },
      );
    }
  }
  return mapWith({ width: 4, height: 4, tiles });
}

describe('validateMap — happy paths', () => {
  it('accepts a clean map with the required zones', () => {
    const result = validateMap(mapWithZones(), REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 2],
        [TEAM_B, 2],
      ]),
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a map with extra zone tiles beyond the minimum', () => {
    const result = validateMap(mapWithZones(), REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 1],
        [TEAM_B, 1],
      ]),
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateMap — terrain', () => {
  it('rejects tiles with unregistered terrain', () => {
    const map = mapFrom(['GxG'], {
      G: { terrain: 'ground' },
      x: { terrain: 'mystery', elevation: 0 },
    });
    const result = validateMap(map, REGISTRY, { requiredZonesPerTeam: new Map() });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_terrain')).toBe(true);
  });
});

describe('validateMap — deployment zones', () => {
  it('rejects an unknown deployment-zone team', () => {
    const tiles = [
      {
        x: 0,
        y: 0,
        terrain: 'ground',
        elevation: 2,
        deploymentZone: teamId('team_phantom'),
      },
    ];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 1],
        [TEAM_B, 1],
      ]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_deployment_team')).toBe(true);
    expect(result.errors.some((e) => e.code === 'missing_deployment_zone')).toBe(true);
  });

  it('rejects a map with no zone tiles for a required team', () => {
    // Only team_a zone tiles; team_b's required count is 1.
    const tiles = [
      { x: 0, y: 0, terrain: 'ground', elevation: 2, deploymentZone: TEAM_A },
    ];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 1],
        [TEAM_B, 1],
      ]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_deployment_zone')).toBe(true);
  });

  it('rejects a map with insufficient zone tiles for a required team', () => {
    // 1 team_b tile but config requires 3.
    const tiles = [
      { x: 0, y: 0, terrain: 'ground', elevation: 2, deploymentZone: TEAM_A },
      { x: 1, y: 0, terrain: 'ground', elevation: 2, deploymentZone: TEAM_B },
    ];
    const map = mapWith({ width: 2, height: 1, tiles });
    const result = validateMap(map, REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 1],
        [TEAM_B, 3],
      ]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'insufficient_deployment_zone')).toBe(true);
  });

  it('treats explicit `null` deployment zone (shared zone) as non-team', () => {
    const tiles = [
      { x: 0, y: 0, terrain: 'ground', elevation: 2, deploymentZone: null },
      { x: 1, y: 0, terrain: 'ground', elevation: 2, deploymentZone: TEAM_A },
      { x: 2, y: 0, terrain: 'ground', elevation: 2, deploymentZone: TEAM_B },
    ];
    const map = mapWith({ width: 3, height: 1, tiles });
    const result = validateMap(map, REGISTRY, {
      requiredZonesPerTeam: requireZones([
        [TEAM_A, 1],
        [TEAM_B, 1],
      ]),
    });
    expect(result.ok).toBe(true);
  });
});

describe('validateMap — structural', () => {
  it('rejects negative elevation', () => {
    const tiles = [{ x: 0, y: 0, terrain: 'ground', elevation: -1 }];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY, { requiredZonesPerTeam: new Map() });
    expect(result.errors.some((e) => e.code === 'negative_elevation')).toBe(true);
  });

  it('rejects tiles outside the declared map bounds', () => {
    const tiles = [{ x: 5, y: 5, terrain: 'ground', elevation: 0 }];
    const map = mapWith({ width: 4, height: 4, tiles });
    const result = validateMap(map, REGISTRY, { requiredZonesPerTeam: new Map() });
    expect(result.errors.some((e) => e.code === 'tile_out_of_bounds')).toBe(true);
  });

  it('rejects duplicate tile positions at the same layer', () => {
    const tiles = [
      { x: 0, y: 0, terrain: 'ground', elevation: 0 },
      { x: 0, y: 0, terrain: 'ground', elevation: 0 },
    ];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY, { requiredZonesPerTeam: new Map() });
    expect(result.errors.some((e) => e.code === 'duplicate_tile_position')).toBe(true);
  });
});

describe('assertMapValid', () => {
  it('throws with all errors bundled when validation fails', () => {
    const map = mapFrom(['Gx'], {
      G: { terrain: 'ground' },
      x: { terrain: 'lava', elevation: 0 },
    });
    expect(() =>
      assertMapValid(map, REGISTRY, {
        requiredZonesPerTeam: requireZones([[TEAM_A, 1]]),
      }),
    ).toThrowError(MapValidationError_Throw);
  });

  it('does not throw on a valid map', () => {
    expect(() =>
      assertMapValid(mapWithZones(), REGISTRY, {
        requiredZonesPerTeam: requireZones([
          [TEAM_A, 1],
          [TEAM_B, 1],
        ]),
      }),
    ).not.toThrow();
  });
});
