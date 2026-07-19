// StackGeometry / deck-lift math (S97 — bridge over/under UI).
// The geometry is the single source of the stacked-cell visual lift;
// these tests pin the clamp behavior and the per-position lift reads
// every renderer layer depends on.

import { describe, expect, it } from 'vitest';
import type { BattleMap, Tile } from '@engine/index.ts';
import {
  DECK_LIFT_MAX_PX,
  DECK_LIFT_MIN_PX,
  DECK_LIFT_PX_PER_ELEVATION,
  TILE_SIZE,
} from './constants.ts';
import { deckLiftPx, positionCenter, StackGeometry, tileCenter } from './world.ts';

function tile(x: number, y: number, layer: number, elevation: number): Tile {
  return {
    x,
    y,
    layer,
    elevation,
    terrain: layer > 0 ? 'bridge' : 'water_shallow',
    properties: [],
  };
}

function mapOf(tiles: Tile[]): BattleMap {
  return { width: 8, height: 8, tiles };
}

describe('deckLiftPx', () => {
  it('scales with the deck/ground elevation delta', () => {
    // Pick a delta inside the clamp window so the proportional term shows.
    const delta = Math.ceil(DECK_LIFT_MIN_PX / DECK_LIFT_PX_PER_ELEVATION);
    expect(deckLiftPx(delta, 0)).toBe(delta * DECK_LIFT_PX_PER_ELEVATION);
  });

  it('clamps small deltas up to the readable floor', () => {
    expect(deckLiftPx(1, 0)).toBe(DECK_LIFT_MIN_PX);
  });

  it('clamps tall spans down to the ceiling', () => {
    expect(deckLiftPx(40, 0)).toBe(DECK_LIFT_MAX_PX);
  });

  it('treats a non-positive delta as a minimal lift, not zero', () => {
    // A stacked cell always lifts — even a degenerate authored stack
    // (deck at or below ground elevation) must keep both layers visible.
    expect(deckLiftPx(2, 2)).toBe(DECK_LIFT_MIN_PX);
    expect(deckLiftPx(1, 3)).toBe(DECK_LIFT_MIN_PX);
  });
});

describe('StackGeometry', () => {
  const geo = new StackGeometry(
    mapOf([
      tile(2, 7, 0, 1), // river under the span
      tile(2, 7, 1, 3), // the deck
      tile(3, 7, 0, 2), // plain single-layer neighbor
    ]),
  );

  it('indexes only cells with two or more tiles', () => {
    expect(geo.stackAt(2, 7)).toBeDefined();
    expect(geo.stackAt(3, 7)).toBeUndefined();
    expect(geo.stackAt(0, 0)).toBeUndefined();
  });

  it('identifies ground and deck layers with the clamped lift', () => {
    const s = geo.stackAt(2, 7)!;
    expect(s.groundLayer).toBe(0);
    expect(s.deckLayer).toBe(1);
    expect(s.liftPx).toBe(deckLiftPx(3, 1));
  });

  it('lifts the deck position and not the ground position', () => {
    expect(geo.liftFor({ x: 2, y: 7, layer: 1 })).toBeGreaterThan(0);
    expect(geo.liftFor({ x: 2, y: 7, layer: 0 })).toBe(0);
    expect(geo.liftFor({ x: 3, y: 7, layer: 0 })).toBe(0);
    expect(geo.isLiftedDeck({ x: 2, y: 7, layer: 1 })).toBe(true);
    expect(geo.isLiftedDeck({ x: 2, y: 7, layer: 0 })).toBe(false);
    expect(geo.isCoveredGround({ x: 2, y: 7, layer: 0 })).toBe(true);
    expect(geo.isCoveredGround({ x: 3, y: 7, layer: 0 })).toBe(false);
  });
});

describe('positionCenter with stack geometry', () => {
  const geo = new StackGeometry(mapOf([tile(2, 7, 0, 1), tile(2, 7, 1, 3)]));

  it('shifts a deck position up-left by the lift and leaves others alone', () => {
    const base = tileCenter(2, 7);
    const lift = geo.stackAt(2, 7)!.liftPx;
    expect(positionCenter({ x: 2, y: 7, layer: 1 }, geo)).toEqual({
      x: base.x - lift,
      y: base.y - lift,
    });
    expect(positionCenter({ x: 2, y: 7, layer: 0 }, geo)).toEqual(base);
    // No geometry supplied → legacy behavior.
    expect(positionCenter({ x: 2, y: 7, layer: 1 })).toEqual(base);
  });
});

describe('visibleGroundRects', () => {
  // A 3-cell north–south span (the Alvera bridge shape): x=2, y=7..9.
  const geo = new StackGeometry(
    mapOf([
      tile(2, 7, 0, 1), tile(2, 7, 1, 3),
      tile(2, 8, 0, 1), tile(2, 8, 1, 3),
      tile(2, 9, 0, 1), tile(2, 9, 1, 3),
      tile(3, 8, 0, 2),
    ]),
  );
  const d = geo.stackAt(2, 7)!.liftPx;

  it('returns nothing for a non-stacked cell', () => {
    expect(geo.visibleGroundRects(3, 8)).toEqual([]);
  });

  it('keeps the right strip open on every cell of a vertical span', () => {
    // Interior + top cells have a stacked south neighbor whose deck
    // overhang covers their bottom strip — the right strip must remain.
    for (const y of [7, 8]) {
      const rects = geo.visibleGroundRects(2, y);
      expect(rects).toHaveLength(1);
      expect(rects[0]).toEqual({ px: 3 * TILE_SIZE - d, py: y * TILE_SIZE, w: d, h: TILE_SIZE });
    }
  });

  it('gives the span-end cell the full L (right + trimmed bottom strips)', () => {
    const rects = geo.visibleGroundRects(2, 9);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toEqual({ px: 3 * TILE_SIZE - d, py: 9 * TILE_SIZE, w: d, h: TILE_SIZE });
    expect(rects[1]).toEqual({
      px: 2 * TILE_SIZE,
      py: 10 * TILE_SIZE - d,
      w: TILE_SIZE - d,
      h: d,
    });
  });
});
