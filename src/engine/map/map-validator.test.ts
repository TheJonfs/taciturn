import { describe, expect, it } from 'vitest';
import { assertMapValid, MapValidationError_Throw, validateMap } from './map-validator.ts';
import { mapFrom, mapWith } from './test-fixtures.ts';
import type { TerrainRegistry } from './terrain-registry.ts';

// S70: zone-coverage validation moved out of `validateMap` into
// `validateDeploymentZones` (see deployment-zone.test.ts). `validateMap`
// now validates terrain geometry only.

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
]);

describe('validateMap — happy paths', () => {
  it('accepts a clean ground map', () => {
    const result = validateMap(mapWith({ width: 4, height: 4, tiles: gridTiles(4, 4) }), REGISTRY);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

function gridTiles(w: number, h: number): Array<{ x: number; y: number; terrain: string; elevation: number }> {
  const tiles: Array<{ x: number; y: number; terrain: string; elevation: number }> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) tiles.push({ x, y, terrain: 'ground', elevation: 2 });
  }
  return tiles;
}

describe('validateMap — terrain', () => {
  it('rejects tiles with unregistered terrain', () => {
    const map = mapFrom(['GxG'], {
      G: { terrain: 'ground' },
      x: { terrain: 'mystery', elevation: 0 },
    });
    const result = validateMap(map, REGISTRY);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'unknown_terrain')).toBe(true);
  });
});

describe('validateMap — structural', () => {
  it('rejects negative elevation', () => {
    const tiles = [{ x: 0, y: 0, terrain: 'ground', elevation: -1 }];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY);
    expect(result.errors.some((e) => e.code === 'negative_elevation')).toBe(true);
  });

  it('rejects tiles outside the declared map bounds', () => {
    const tiles = [{ x: 5, y: 5, terrain: 'ground', elevation: 0 }];
    const map = mapWith({ width: 4, height: 4, tiles });
    const result = validateMap(map, REGISTRY);
    expect(result.errors.some((e) => e.code === 'tile_out_of_bounds')).toBe(true);
  });

  it('rejects duplicate tile positions at the same layer', () => {
    const tiles = [
      { x: 0, y: 0, terrain: 'ground', elevation: 0 },
      { x: 0, y: 0, terrain: 'ground', elevation: 0 },
    ];
    const map = mapWith({ width: 1, height: 1, tiles });
    const result = validateMap(map, REGISTRY);
    expect(result.errors.some((e) => e.code === 'duplicate_tile_position')).toBe(true);
  });
});

describe('assertMapValid', () => {
  it('throws with all errors bundled when validation fails', () => {
    const map = mapFrom(['Gx'], {
      G: { terrain: 'ground' },
      x: { terrain: 'lava', elevation: 0 },
    });
    expect(() => assertMapValid(map, REGISTRY)).toThrowError(MapValidationError_Throw);
  });

  it('does not throw on a valid map', () => {
    const map = mapWith({ width: 4, height: 4, tiles: gridTiles(4, 4) });
    expect(() => assertMapValid(map, REGISTRY)).not.toThrow();
  });
});
