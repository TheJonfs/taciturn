// S96 (bridges, ADR-0155) — deck LoS band + multi-layer map validation.
//
// A DECK (layer ≥ 1 tile) occludes straight-line rays only in its thin body,
// the open band (elevation − BRIDGE_DECK_THICKNESS, elevation): rays pass
// over the top, graze the underside, and travel clean beneath — closing the
// documented "buried under a bridge" limit. The validator enforces the new
// multi-layer consistency rules (ground beneath, clearance, one deck layer).

import { describe, expect, it } from 'vitest';
import { hasLineOfSight } from './line-of-sight.ts';
import { validateMap } from './map-validator.ts';
import { mapWith, type TileSpec } from './test-fixtures.ts';
import type { TerrainRegistry } from './terrain-registry.ts';

const REGISTRY: TerrainRegistry = new Map([
  ['ground', new Set(['land'])],
  ['bridge', new Set(['land'])],
]);

// A 5×1 corridor of ground at elevation 2 with a deck (layer 1, elev 5)
// over the middle cell — clearance 3.
function bridgedCorridor(deckElevation = 5): ReturnType<typeof mapWith> {
  const tiles: TileSpec[] = [];
  for (let x = 0; x < 5; x++) tiles.push({ x, y: 0, elevation: 2 });
  tiles.push({ x: 2, y: 0, layer: 1, elevation: deckElevation, terrain: 'bridge' });
  return mapWith({ width: 5, height: 1, tiles });
}

describe('deck LoS band (S96 — the buried-under-bridge limit is closed)', () => {
  it('a ground-level ray passes clean UNDER the deck', () => {
    const map = bridgedCorridor();
    // Both endpoints on the ground (elev 2); the ray crosses the bridged
    // cell at elevation 2 — well below the deck's band (4, 5).
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 2 }, { x: 4, y: 0, elevation: 2 }),
    ).toBe(true);
  });

  it('a ray through the deck band is blocked', () => {
    const map = bridgedCorridor();
    // Endpoints at elevation 4.5 → the interpolated ray crosses the bridged
    // cell inside (4, 5), the deck's solid body.
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 4.5 }, { x: 4, y: 0, elevation: 4.5 }),
    ).toBe(false);
  });

  it('a ray over the deck top passes (graze convention matches ground)', () => {
    const map = bridgedCorridor();
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 5 }, { x: 4, y: 0, elevation: 5 }),
    ).toBe(true);
  });

  it('a ray grazing the underside passes (strict bound, column convention)', () => {
    const map = bridgedCorridor();
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 4 }, { x: 4, y: 0, elevation: 4 }),
    ).toBe(true);
  });

  it('layer-0 terrain mass still blocks as bedrock (unchanged)', () => {
    const tiles: TileSpec[] = [];
    for (let x = 0; x < 5; x++) tiles.push({ x, y: 0, elevation: x === 2 ? 8 : 2 });
    const map = mapWith({ width: 5, height: 1, tiles });
    expect(
      hasLineOfSight(map, { x: 0, y: 0, elevation: 2 }, { x: 4, y: 0, elevation: 2 }),
    ).toBe(false);
  });
});

describe('map validator — multi-layer rules (S96)', () => {
  it('accepts a well-formed deck (ground beneath, clearance ≥ 2)', () => {
    const result = validateMap(bridgedCorridor(), REGISTRY);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a deck with no layer-0 tile beneath it', () => {
    const map = mapWith({
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0, elevation: 2 },
        { x: 1, y: 0, layer: 1, elevation: 5, terrain: 'bridge' }, // no ground at (1,0)
      ],
    });
    const result = validateMap(map, REGISTRY);
    expect(result.errors.some((e) => e.code === 'deck_without_ground')).toBe(true);
  });

  it('rejects a deck clearing its under-tile by less than 2', () => {
    const result = validateMap(bridgedCorridor(3), REGISTRY); // ground 2, deck 3 → clearance 1
    expect(result.errors.some((e) => e.code === 'deck_clearance_too_low')).toBe(true);
  });

  it('rejects a second stacked layer (v1: one deck layer max)', () => {
    const map = mapWith({
      width: 1,
      height: 1,
      tiles: [
        { x: 0, y: 0, elevation: 0 },
        { x: 0, y: 0, layer: 1, elevation: 3, terrain: 'bridge' },
        { x: 0, y: 0, layer: 2, elevation: 6, terrain: 'bridge' },
      ],
    });
    const result = validateMap(map, REGISTRY);
    expect(result.errors.some((e) => e.code === 'layer_too_deep')).toBe(true);
  });
});
