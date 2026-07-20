// Bridge deck art selection (S97 six-piece kit) — the map fully
// determines each deck tile's piece; these tests pin the rule and the
// live Alvera content.

import { describe, expect, it } from 'vitest';
import type { BattleMap, Tile } from '@engine/index.ts';
import { alveraVillage } from '../content/maps/alvera-village.ts';
import { bridgeDeckVariantFor, isBridgeSurface, BRIDGE_DECK_VARIANT_ORDER } from './bridge-variant.ts';

function tile(
  x: number,
  y: number,
  layer: number,
  elevation: number,
  terrain = layer > 0 ? 'bridge' : 'ground',
  properties: string[] = [],
): Tile {
  return { x, y, layer, elevation, terrain, properties };
}

function mapOf(tiles: Tile[]): BattleMap {
  return { width: 12, height: 12, tiles };
}

function deckAt(map: BattleMap, x: number, y: number): Tile {
  // The topmost bridge-surface tile at the cell (a lifted deck, or a
  // bridge_ramp-tagged bank tile).
  const t = [...map.tiles]
    .filter((t) => t.x === x && t.y === y && isBridgeSurface(t))
    .sort((a, b) => b.layer - a.layer)[0];
  if (t === undefined) throw new Error(`no bridge tile at (${x},${y})`);
  return t;
}

describe('bridgeDeckVariantFor', () => {
  it('renders the Alvera bridge: rise onto the span, flat across, ramp on the bank', () => {
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 7))).toBe('rise_s');
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 8))).toBe('flat_ns');
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 9))).toBe('flat_ns');
    // The S97 layer-0 ramp at (2, 10): rises toward the higher span
    // tile north of it; the elev-8 house wall south of it is beyond
    // the connectable-step threshold and casts no vote.
    expect(bridgeDeckVariantFor(alveraVillage, deckAt(alveraVillage, 2, 10))).toBe('rise_n');
  });

  it('puts the ramp art on a lower ramp-tagged chain tile, not the deck above it', () => {
    // Mini version of the Alvera south end: a 1-tile deck over water,
    // a bridge_ramp-tagged ground tile south of it, plain banks
    // elsewhere.
    const map = mapOf([
      tile(4, 3, 0, 2),
      tile(4, 4, 0, 0),
      tile(4, 5, 0, 2, 'ground', ['bridge_ramp']),
      tile(4, 6, 0, 2),
      tile(4, 4, 1, 3),
    ]);
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 4))).toBe('rise_s');
    expect(bridgeDeckVariantFor(map, deckAt(map, 4, 5))).toBe('rise_n');
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
