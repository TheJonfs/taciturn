// Bridge deck art selection (S97 six-piece kit) — the map fully
// determines each deck tile's piece; these tests pin the rule and the
// live Alvera content.

import { describe, expect, it } from 'vitest';
import type { BattleMap, Tile } from '@engine/index.ts';
import { alveraVillage } from '../content/maps/alvera-village.ts';
import { bridgeDeckVariantFor, BRIDGE_DECK_VARIANT_ORDER } from './bridge-variant.ts';

function tile(
  x: number,
  y: number,
  layer: number,
  elevation: number,
  terrain = layer > 0 ? 'bridge' : 'ground',
): Tile {
  return { x, y, layer, elevation, terrain, properties: [] };
}

function mapOf(tiles: Tile[]): BattleMap {
  return { width: 12, height: 12, tiles };
}

function deckAt(map: BattleMap, x: number, y: number): Tile {
  const t = map.tiles.find((t) => t.x === x && t.y === y && t.layer === 1);
  if (t === undefined) throw new Error(`no deck tile at (${x},${y})`);
  return t;
}

describe('bridgeDeckVariantFor', () => {
  it('renders the Alvera western bridge as the hump-bridge arc (Chris 1-2-3)', () => {
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 7))).toBe('rise_s');
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 8))).toBe('flat_ns');
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 9))).toBe('rise_n');
  });

  it('picks flat pieces for interior tiles and level-connected ends (EW axis)', () => {
    // Banks at deck elevation on both ends → no inclines anywhere.
    const map = mapOf([
      tile(3, 5, 0, 3), tile(4, 5, 0, 0), tile(5, 5, 0, 0), tile(6, 5, 0, 3),
      tile(4, 5, 1, 3), tile(5, 5, 1, 3),
    ]);
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 5))).toBe('flat_ew');
    expect(bridgeDeckVariantFor(map, deckAt(map, 5, 5))).toBe('flat_ew');
  });

  it('rises toward the higher bank on a consistently sloping EW ramp', () => {
    // West bank elev 2 (below deck 3), east bank elev 5 (above deck 3):
    // both end tiles vote rise_e (high edge east) — a ramp, not an arch.
    const map = mapOf([
      tile(3, 5, 0, 2), tile(4, 5, 0, 0), tile(5, 5, 0, 0), tile(6, 5, 0, 5),
      tile(4, 5, 1, 3), tile(5, 5, 1, 3),
    ]);
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 5))).toBe('rise_e');
    expect(bridgeDeckVariantFor(map, deckAt(map, 5, 5))).toBe('rise_e');
  });

  it('falls back to flat for a single-tile arch (conflicting end votes)', () => {
    // One deck tile, both banks lower: the kit has no double-incline
    // piece, so the conflicting votes collapse to the axis flat.
    const map = mapOf([
      tile(4, 4, 0, 2), tile(4, 5, 0, 0), tile(4, 6, 0, 2),
      tile(4, 5, 1, 3),
    ]);
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 5))).toBe('flat_ns');
  });

  it('keeps a single ramp-end incline on a single-tile span', () => {
    // North bank lower, south bank level → one vote, rise_s stands.
    const map = mapOf([
      tile(4, 4, 0, 1), tile(4, 5, 0, 0), tile(4, 6, 0, 3),
      tile(4, 5, 1, 3),
    ]);
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 5))).toBe('rise_s');
  });

  it('exposes a pool order covering every variant exactly once', () => {
    expect([...BRIDGE_DECK_VARIANT_ORDER].sort()).toEqual(
      ['flat_ew', 'flat_ns', 'rise_e', 'rise_n', 'rise_s', 'rise_w'],
    );
  });
});
