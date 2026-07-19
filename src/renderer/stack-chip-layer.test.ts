// Stack chip geometry (S97 — bridge over/under UI, WI3). The chip's tap
// region and its drawn rects come from the same `hits` table, so these
// tests pin the placement contract: segments anchor beside the cell
// (following the deck lift), taps inside a segment resolve the layer-
// explicit position, taps outside miss, and the hover-freeze margin
// bridges the cell→chip gap.

import { describe, expect, it } from 'vitest';
import type { BattleMap, Tile } from '@engine/index.ts';
import {
  STACK_CHIP_GAP,
  STACK_CHIP_SEG_GAP,
  STACK_CHIP_SEG_HEIGHT,
  STACK_CHIP_SEG_WIDTH,
  TILE_SIZE,
} from './constants.ts';
import { StackChipLayer } from './stack-chip-layer.ts';
import { StackGeometry } from './world.ts';

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

function geoWithStack(x: number, y: number): StackGeometry {
  const map: BattleMap = {
    width: 16,
    height: 16,
    tiles: [tile(x, y, 0, 1), tile(x, y, 1, 3)],
  };
  return new StackGeometry(map);
}

const SEGMENTS = [
  { layer: 1, label: '3', active: true },
  { layer: 0, label: '1', active: false },
];

describe('StackChipLayer', () => {
  it('is empty (no tap targets) until shown, and clears on show(null)', () => {
    const chip = new StackChipLayer();
    expect(chip.visible).toBe(false);
    expect(chip.segmentAt({ x: 0, y: 0 })).toBeNull();
    chip.show({ x: 2, y: 7, segments: SEGMENTS, flipToLeft: false }, geoWithStack(2, 7));
    expect(chip.visible).toBe(true);
    chip.show(null, null);
    expect(chip.visible).toBe(false);
  });

  it('anchors right of the cell at the lifted deck top; taps resolve layer-explicit positions', () => {
    const geo = geoWithStack(2, 7);
    const lift = geo.stackAt(2, 7)!.liftPx;
    const chip = new StackChipLayer();
    chip.show({ x: 2, y: 7, segments: SEGMENTS, flipToLeft: false }, geo);

    const chipX = 3 * TILE_SIZE + STACK_CHIP_GAP;
    const topY = 7 * TILE_SIZE - lift;
    // Center of the first (deck) segment.
    const deckPick = chip.segmentAt({
      x: chipX + STACK_CHIP_SEG_WIDTH / 2,
      y: topY + STACK_CHIP_SEG_HEIGHT / 2,
    });
    expect(deckPick).toEqual({ x: 2, y: 7, layer: 1 });
    // Center of the second (ground) segment.
    const groundPick = chip.segmentAt({
      x: chipX + STACK_CHIP_SEG_WIDTH / 2,
      y: topY + STACK_CHIP_SEG_HEIGHT + STACK_CHIP_SEG_GAP + STACK_CHIP_SEG_HEIGHT / 2,
    });
    expect(groundPick).toEqual({ x: 2, y: 7, layer: 0 });
    // A point left of the chip (inside the cell) is not a chip tap.
    expect(chip.segmentAt({ x: chipX - STACK_CHIP_GAP - 2, y: topY + 4 })).toBeNull();
  });

  it('flips to the left edge for last-column cells', () => {
    const geo = geoWithStack(15, 7);
    const lift = geo.stackAt(15, 7)!.liftPx;
    const chip = new StackChipLayer();
    chip.show({ x: 15, y: 7, segments: SEGMENTS, flipToLeft: true }, geo);
    const chipX = 15 * TILE_SIZE - STACK_CHIP_GAP - STACK_CHIP_SEG_WIDTH - lift;
    const pick = chip.segmentAt({
      x: chipX + STACK_CHIP_SEG_WIDTH / 2,
      y: 7 * TILE_SIZE - lift + STACK_CHIP_SEG_HEIGHT / 2,
    });
    expect(pick).toEqual({ x: 15, y: 7, layer: 1 });
  });

  it('containsPoint inflates by the cell→chip gap so the hover freeze bridges it', () => {
    const geo = geoWithStack(2, 7);
    const lift = geo.stackAt(2, 7)!.liftPx;
    const chip = new StackChipLayer();
    chip.show({ x: 2, y: 7, segments: SEGMENTS, flipToLeft: false }, geo);
    const chipX = 3 * TILE_SIZE + STACK_CHIP_GAP;
    const topY = 7 * TILE_SIZE - lift;
    // Point in the gap between cell edge and chip: not a tap, but frozen.
    const gapPoint = { x: chipX - STACK_CHIP_GAP / 2, y: topY + 4 };
    expect(chip.segmentAt(gapPoint)).toBeNull();
    expect(chip.containsPoint(gapPoint)).toBe(true);
    // Far away: neither.
    expect(chip.containsPoint({ x: chipX + 200, y: topY })).toBe(false);
  });
});
