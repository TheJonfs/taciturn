// Deployment-zone registry tests (S70). These lock in the zones that
// used to be baked into each map's tiles — the migration is behavior-
// preserving, so the per-team tile sets, counts, and terrain properties
// must match the pre-S70 map tests exactly. Also exercises the registry
// lookup and validates each config against its terrain.

import { describe, expect, it } from 'vitest';
import {
  subZoneIndexForTile,
  teamForTile,
  tilesForTeam,
  tileAt,
  validateDeploymentZones,
  zoneForTeam,
  type TeamId,
} from '@engine/index.ts';
import { teamId } from '@engine/index.ts';
import { DEPLOYMENT_ZONE_REGISTRY, deploymentZonesFor } from './registry.ts';
import { riverRidge } from '@content/maps/river-ridge.ts';
import { stonebridge } from '@content/maps/stonebridge.ts';
import { marshmoor } from '@content/maps/marshmoor.ts';
import { mountainPass } from '@content/maps/mountain-pass.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

function req(perTeam: ReadonlyArray<[TeamId, number]>): ReadonlyMap<TeamId, number> {
  return new Map(perTeam);
}

describe('deploymentZonesFor lookup', () => {
  it('returns the default config', () => {
    expect(deploymentZonesFor('river_ridge')).toBe(DEPLOYMENT_ZONE_REGISTRY['river_ridge']!['default']);
  });

  it('throws on an unknown map', () => {
    expect(() => deploymentZonesFor('nowhere')).toThrow(/no deployment-zone configs/);
  });

  it('throws on an unknown config name', () => {
    expect(() => deploymentZonesFor('river_ridge', 'ambush')).toThrow(/no deployment-zone config named/);
  });
});

describe('River Ridge default zones (migrated from baked tiles)', () => {
  const zones = deploymentZonesFor('river_ridge');

  it('Blue covers rows 0-2 cols 5-8 (12 tiles)', () => {
    expect(tilesForTeam(zones, BLUE)).toHaveLength(12);
    expect(teamForTile(zones, { x: 5, y: 0, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 8, y: 2, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 4, y: 0, layer: 0 })).toBeUndefined();
  });

  it('Red covers rows 11-13 cols 5-8 (12 tiles)', () => {
    expect(tilesForTeam(zones, RED)).toHaveLength(12);
    expect(teamForTile(zones, { x: 5, y: 11, layer: 0 })).toBe(RED);
    expect(teamForTile(zones, { x: 8, y: 13, layer: 0 })).toBe(RED);
    expect(teamForTile(zones, { x: 4, y: 13, layer: 0 })).toBeUndefined();
  });

  it('validates cleanly against the terrain (4-unit teams)', () => {
    const result = validateDeploymentZones(zones, riverRidge, {
      requiredZonesPerTeam: req([[BLUE, 4], [RED, 4]]),
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('Stonebridge default zones', () => {
  const zones = deploymentZonesFor('stonebridge');

  it('Blue covers rows 0-1 cols 5-8 (8 tiles), Red rows 14-15 cols 5-8 (8)', () => {
    expect(tilesForTeam(zones, BLUE)).toHaveLength(8);
    expect(tilesForTeam(zones, RED)).toHaveLength(8);
    expect(teamForTile(zones, { x: 5, y: 0, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 8, y: 1, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 5, y: 2, layer: 0 })).toBeUndefined();
    expect(teamForTile(zones, { x: 5, y: 14, layer: 0 })).toBe(RED);
    expect(teamForTile(zones, { x: 8, y: 15, layer: 0 })).toBe(RED);
  });

  it('every zone tile is flat ground (elev 2) on the terrain', () => {
    for (const team of [BLUE, RED]) {
      for (const pos of tilesForTeam(zones, team)) {
        const tile = tileAt(stonebridge, pos.x, pos.y, pos.layer)!;
        expect(tile.elevation).toBe(2);
        expect(tile.terrain).toBe('ground');
      }
    }
  });

  it('validates cleanly against the terrain (4-unit teams)', () => {
    const result = validateDeploymentZones(zones, stonebridge, {
      requiredZonesPerTeam: req([[BLUE, 4], [RED, 4]]),
    });
    expect(result.ok).toBe(true);
  });
});

describe('Marshmoor default zones', () => {
  const zones = deploymentZonesFor('marshmoor');

  it('Blue (NE) covers cols 13-15 rows 0-2 (9), Red (SW) cols 0-2 rows 13-15 (9)', () => {
    expect(tilesForTeam(zones, BLUE)).toHaveLength(9);
    expect(tilesForTeam(zones, RED)).toHaveLength(9);
    expect(teamForTile(zones, { x: 13, y: 0, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 15, y: 2, layer: 0 })).toBe(BLUE);
    expect(teamForTile(zones, { x: 12, y: 0, layer: 0 })).toBeUndefined();
    expect(teamForTile(zones, { x: 0, y: 13, layer: 0 })).toBe(RED);
    expect(teamForTile(zones, { x: 2, y: 15, layer: 0 })).toBe(RED);
  });

  it('every zone tile is land (elev ≥ 2) ground — no water deployment', () => {
    for (const team of [BLUE, RED]) {
      for (const pos of tilesForTeam(zones, team)) {
        const tile = tileAt(marshmoor, pos.x, pos.y, pos.layer)!;
        expect(tile.elevation).toBeGreaterThanOrEqual(2);
        expect(tile.terrain).toBe('ground');
      }
    }
  });

  it('preserves the intentional elev-4 asymmetry in each zone', () => {
    expect(tileAt(marshmoor, 14, 1, 0)!.elevation).toBe(4);
    expect(teamForTile(zones, { x: 14, y: 1, layer: 0 })).toBe(BLUE);
    expect(tileAt(marshmoor, 0, 15, 0)!.elevation).toBe(4);
    expect(teamForTile(zones, { x: 0, y: 15, layer: 0 })).toBe(RED);
  });

  it('validates cleanly against the terrain (5-unit teams)', () => {
    const result = validateDeploymentZones(zones, marshmoor, {
      requiredZonesPerTeam: req([[BLUE, 5], [RED, 5]]),
    });
    expect(result.ok).toBe(true);
  });
});

describe('Mountain Pass split config (S70)', () => {
  const zones = deploymentZonesFor('mountain_pass');

  it('victim (Blue) is one uncapped NW-valley sub-zone of 8 tiles', () => {
    const blue = zoneForTeam(zones, BLUE)!;
    expect(blue.subZones).toHaveLength(1);
    expect(blue.subZones[0]!.cap).toBeUndefined();
    expect(blue.subZones[0]!.tiles).toHaveLength(8);
    expect(teamForTile(zones, { x: 2, y: 2, layer: 0 })).toBe(BLUE);
  });

  it('ambusher (Red) splits into SW massif (cap 3) + NE edge (cap 2)', () => {
    const red = zoneForTeam(zones, RED)!;
    expect(red.subZones).toHaveLength(2);
    expect(red.subZones[0]!.cap).toBe(3);
    expect(red.subZones[1]!.cap).toBe(2);
    // SW massif tiles resolve to sub-zone 0; NE edge to sub-zone 1.
    expect(subZoneIndexForTile(zones, RED, { x: 8, y: 13, layer: 0 })).toBe(0);
    expect(subZoneIndexForTile(zones, RED, { x: 14, y: 11, layer: 0 })).toBe(1);
  });

  it('caps sum to the 5-unit roster (ambusher fills exactly)', () => {
    const red = zoneForTeam(zones, RED)!;
    const capSum = red.subZones.reduce((s, sz) => s + (sz.cap ?? 0), 0);
    expect(capSum).toBe(5);
  });

  it('every zone tile is walkable land — ground/grass_rock/rock, never water', () => {
    // The ambusher's SE-heights tiles span the rock (elev ≥ 7) and
    // grass_rock (elev 5-6) bands; the victim's NW valley is `ground`.
    // All are land — no unit deploys in water.
    for (const team of [BLUE, RED]) {
      for (const pos of tilesForTeam(zones, team)) {
        const tile = tileAt(mountainPass, pos.x, pos.y, pos.layer)!;
        expect(['ground', 'grass_rock', 'rock']).toContain(tile.terrain);
      }
    }
  });

  it('validates cleanly against the terrain (5-unit teams)', () => {
    const result = validateDeploymentZones(zones, mountainPass, {
      requiredZonesPerTeam: req([[BLUE, 5], [RED, 5]]),
    });
    expect(result.ok).toBe(true);
  });
});
