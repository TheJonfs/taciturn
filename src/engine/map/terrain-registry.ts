// Terrain tag registry — semantic identity for terrain types.
// See ADR-0073.
//
// The engine's `TerrainType` is an open string union; map authors can
// add new variants freely. Tags layer membership on top so that hook
// handlers (Tidewalker, Float, future water/ice/swamp passives) can
// register against a *family* (`'water'`) rather than enumerating every
// terrain variant by literal string.
//
// Mirrors the `damageTags` pattern (a damage instance carries a set of
// tags; resistance / amplification keys on those tags). Here a terrain
// type carries a set of tags; movement-bucket abilities key on those
// tags.
//
// Registry lives on the ruleset (`ruleset.terrain.tags`). An alternate
// ruleset could ship a different mapping (e.g., a "hardcore" ruleset
// could tag `'swamp'` with `['water', 'organic']` so Tidewalker still
// applies). The registry is catalog-time data — not part of GameState.
//
// Convenience helpers (`mapTerrainCostsByTag`, `addTerrainsWithTag`)
// keep handler authoring compact: handlers don't iterate the registry
// directly. Helpers return new immutable containers — same composition
// discipline as the chain hooks themselves.

import type { TerrainType } from '../types/index.ts';

export type TerrainTag = string;

export type TerrainRegistry = ReadonlyMap<TerrainType, ReadonlySet<TerrainTag>>;

// True iff `terrain` is registered with `tag`. Unregistered terrain
// types return false (an unfamiliar terrain has no tags).
export function terrainHasTag(
  registry: TerrainRegistry,
  terrain: TerrainType,
  tag: TerrainTag,
): boolean {
  return registry.get(terrain)?.has(tag) ?? false;
}

// Every terrain type in the registry that carries `tag`, in insertion
// order. Returns an empty array if no terrain carries the tag.
export function terrainsWithTag(
  registry: TerrainRegistry,
  tag: TerrainTag,
): ReadonlyArray<TerrainType> {
  const out: TerrainType[] = [];
  for (const [terrain, tags] of registry) {
    if (tags.has(tag)) out.push(terrain);
  }
  return out;
}

// Build a new terrain-cost map: copy `baseValue`, then for every terrain
// in the registry tagged with `tag`, look up its current cost (or
// `defaultCost` if not present) and apply `transform`. The result is a
// new Map; the input is not mutated.
//
// Tidewalker uses this to apply a -1 (floor-1) decrement to every
// `'water'`-tagged terrain regardless of which water variants are
// registered in the active ruleset.
export function mapTerrainCostsByTag(
  baseValue: ReadonlyMap<TerrainType, number>,
  registry: TerrainRegistry,
  tag: TerrainTag,
  transform: (cost: number) => number,
  defaultCost: number = 1,
): ReadonlyMap<TerrainType, number> {
  const next = new Map<TerrainType, number>(baseValue);
  for (const terrain of terrainsWithTag(registry, tag)) {
    const current = next.get(terrain) ?? defaultCost;
    next.set(terrain, transform(current));
  }
  return next;
}

// Build a new canEnter set: copy `baseValue`, then add every terrain
// in the registry tagged with `tag`. Float uses this to add every
// `'water'`-tagged terrain regardless of which water variants ship.
export function addTerrainsWithTag(
  baseValue: ReadonlySet<TerrainType>,
  registry: TerrainRegistry,
  tag: TerrainTag,
): ReadonlySet<TerrainType> {
  const next = new Set<TerrainType>(baseValue);
  for (const terrain of terrainsWithTag(registry, tag)) {
    next.add(terrain);
  }
  return next;
}
