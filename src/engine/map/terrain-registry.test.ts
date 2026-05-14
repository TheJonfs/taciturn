import { describe, expect, it } from 'vitest';
import {
  addTerrainsWithTag,
  mapAllTerrainCosts,
  mapTerrainCostsByTag,
  terrainHasTag,
  terrainsWithTag,
  type TerrainRegistry,
} from './terrain-registry.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
]);

// A forward-looking registry with a high-cost terrain — exercises that
// Float's leveller stays correct as new terrain types are registered.
const REGISTRY_WITH_SWAMP: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['water_shallow', new Set(['water', 'shallow'])],
  ['water_deep', new Set(['water', 'deep'])],
  ['swamp', new Set(['water', 'organic'])],
]);

describe('terrainHasTag', () => {
  it('returns true when terrain carries the tag', () => {
    expect(terrainHasTag(REGISTRY, 'water_shallow', 'water')).toBe(true);
    expect(terrainHasTag(REGISTRY, 'water_shallow', 'shallow')).toBe(true);
    expect(terrainHasTag(REGISTRY, 'water_deep', 'water')).toBe(true);
    expect(terrainHasTag(REGISTRY, 'ground', 'land')).toBe(true);
  });

  it('returns false when terrain does not carry the tag', () => {
    expect(terrainHasTag(REGISTRY, 'ground', 'water')).toBe(false);
    expect(terrainHasTag(REGISTRY, 'water_shallow', 'deep')).toBe(false);
  });

  it('returns false for unregistered terrain', () => {
    expect(terrainHasTag(REGISTRY, 'lava', 'water')).toBe(false);
  });
});

describe('terrainsWithTag', () => {
  it('returns every terrain carrying the tag', () => {
    expect(terrainsWithTag(REGISTRY, 'water')).toEqual(['water_shallow', 'water_deep']);
    expect(terrainsWithTag(REGISTRY, 'land')).toEqual(['ground']);
    expect(terrainsWithTag(REGISTRY, 'shallow')).toEqual(['water_shallow']);
  });

  it('returns empty when no terrain carries the tag', () => {
    expect(terrainsWithTag(REGISTRY, 'lava')).toEqual([]);
  });
});

describe('mapTerrainCostsByTag', () => {
  it('applies transform to every cost for tagged terrain, preserving untouched entries', () => {
    const base = new Map([
      ['ground', 1],
      ['water_shallow', 2],
      ['water_deep', 3],
    ]);
    const next = mapTerrainCostsByTag(base, REGISTRY, 'water', (c) => Math.max(1, c - 1));
    expect(next.get('ground')).toBe(1);
    expect(next.get('water_shallow')).toBe(1);
    expect(next.get('water_deep')).toBe(2);
  });

  it('uses defaultCost when the tagged terrain has no entry in baseValue', () => {
    const base = new Map<string, number>([['ground', 1]]);
    const next = mapTerrainCostsByTag(base, REGISTRY, 'water', (c) => c + 5, 2);
    expect(next.get('water_shallow')).toBe(7);
    expect(next.get('water_deep')).toBe(7);
  });

  it('returns a new map without mutating the input', () => {
    const base = new Map([['water_shallow', 2]]);
    const next = mapTerrainCostsByTag(base, REGISTRY, 'water', (c) => c + 1);
    expect(base.get('water_shallow')).toBe(2);
    expect(next).not.toBe(base);
    expect(next.get('water_shallow')).toBe(3);
  });

  it('is a no-op when no terrain carries the tag', () => {
    const base = new Map([['ground', 1]]);
    const next = mapTerrainCostsByTag(base, REGISTRY, 'lava', (c) => c + 100);
    expect(next.get('ground')).toBe(1);
    expect(next.size).toBe(1);
  });
});

describe('mapAllTerrainCosts', () => {
  it("flattens every registered terrain's cost to min(cost, 1) — Float's leveller", () => {
    const base = new Map([
      ['water_shallow', 2],
      ['water_deep', 3],
      ['swamp', 4],
    ]);
    const next = mapAllTerrainCosts(base, REGISTRY_WITH_SWAMP, (c) => Math.min(c, 1));
    expect(next.get('water_shallow')).toBe(1);
    expect(next.get('water_deep')).toBe(1);
    expect(next.get('swamp')).toBe(1);
    // `ground` had no entry — picks up defaultCost (1), then min(1,1) = 1.
    expect(next.get('ground')).toBe(1);
  });

  it('uses defaultCost for registered terrain absent from baseValue', () => {
    const base = new Map<string, number>([]);
    const next = mapAllTerrainCosts(base, REGISTRY_WITH_SWAMP, (c) => c + 10, 4);
    // Every registered terrain resolves to defaultCost (4) then +10.
    expect(next.get('ground')).toBe(14);
    expect(next.get('swamp')).toBe(14);
  });

  it('returns a new map without mutating the input', () => {
    const base = new Map([['water_deep', 3]]);
    const next = mapAllTerrainCosts(base, REGISTRY, (c) => Math.min(c, 1));
    expect(base.get('water_deep')).toBe(3);
    expect(next).not.toBe(base);
    expect(next.get('water_deep')).toBe(1);
  });
});

describe('addTerrainsWithTag', () => {
  it('adds every tagged terrain to the set', () => {
    const base = new Set(['ground']);
    const next = addTerrainsWithTag(base, REGISTRY, 'water');
    expect(next.has('ground')).toBe(true);
    expect(next.has('water_shallow')).toBe(true);
    expect(next.has('water_deep')).toBe(true);
  });

  it('preserves existing entries that are not in the registry', () => {
    const base = new Set(['ground', 'cloud']);
    const next = addTerrainsWithTag(base, REGISTRY, 'water');
    expect(next.has('cloud')).toBe(true);
  });

  it('returns a new set without mutating the input', () => {
    const base = new Set(['ground']);
    const next = addTerrainsWithTag(base, REGISTRY, 'water');
    expect(base.has('water_shallow')).toBe(false);
    expect(next).not.toBe(base);
  });

  it('is a no-op when no terrain carries the tag', () => {
    const base = new Set(['ground']);
    const next = addTerrainsWithTag(base, REGISTRY, 'lava');
    expect(next.size).toBe(1);
    expect(next.has('ground')).toBe(true);
  });
});
