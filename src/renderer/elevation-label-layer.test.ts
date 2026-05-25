import { describe, expect, it } from 'vitest';
import {
  ElevationLabelLayer,
  elevationLabelColor,
  elevationLabelFor,
} from './elevation-label-layer.ts';
import {
  ELEVATION_LABEL_COLOR_HIGH,
  ELEVATION_LABEL_COLOR_LOW,
  ELEVATION_LABEL_SATURATION_ELEV,
} from './constants.ts';
import type { BattleMap, Tile } from '@engine/index.ts';

describe('elevationLabelFor — every tile labelled', () => {
  it('labels water tiles (elev 0/1)', () => {
    expect(elevationLabelFor(0)).toBe('0');
    expect(elevationLabelFor(1)).toBe('1');
  });

  it('labels baseline ground (elev 2)', () => {
    expect(elevationLabelFor(2)).toBe('2');
  });

  it('labels ridge tiers (elev 3-9)', () => {
    expect(elevationLabelFor(3)).toBe('3');
    expect(elevationLabelFor(7)).toBe('7');
    expect(elevationLabelFor(9)).toBe('9');
  });

  it('generalizes past v1 authored tiers', () => {
    expect(elevationLabelFor(12)).toBe('12');
  });
});

describe('elevationLabelColor — cyan→gold two-hue ramp', () => {
  it('elevation 0 → the LOW (cyan) anchor', () => {
    expect(elevationLabelColor(0)).toBe(ELEVATION_LABEL_COLOR_LOW);
  });

  it('elevation at the saturation point → the HIGH (gold) anchor', () => {
    expect(elevationLabelColor(ELEVATION_LABEL_SATURATION_ELEV)).toBe(
      ELEVATION_LABEL_COLOR_HIGH,
    );
  });

  it('clamps above the saturation point (no runaway ramp)', () => {
    expect(elevationLabelColor(ELEVATION_LABEL_SATURATION_ELEV + 5)).toBe(
      ELEVATION_LABEL_COLOR_HIGH,
    );
    expect(elevationLabelColor(99)).toBe(ELEVATION_LABEL_COLOR_HIGH);
  });

  it('mid elevations interpolate between the anchors', () => {
    const mid = elevationLabelColor(ELEVATION_LABEL_SATURATION_ELEV / 2);
    // Channel-by-channel, the midpoint sits strictly between the anchors
    // (the anchors differ on every channel, so no channel is degenerate).
    const chan = (c: number, shift: number) => (c >> shift) & 0xff;
    for (const shift of [16, 8, 0]) {
      const lo = chan(ELEVATION_LABEL_COLOR_LOW, shift);
      const hi = chan(ELEVATION_LABEL_COLOR_HIGH, shift);
      const m = chan(mid, shift);
      const min = Math.min(lo, hi);
      const max = Math.max(lo, hi);
      expect(m).toBeGreaterThanOrEqual(min);
      expect(m).toBeLessThanOrEqual(max);
    }
  });

  it('ramps monotonically warmer (red channel rises with elevation)', () => {
    const redOf = (c: number) => (c >> 16) & 0xff;
    const r0 = redOf(elevationLabelColor(0));
    const r5 = redOf(elevationLabelColor(5));
    const r10 = redOf(elevationLabelColor(10));
    expect(r5).toBeGreaterThan(r0);
    expect(r10).toBeGreaterThan(r5);
  });
});

// S50 regression: ElevationLabelLayer.draw is idempotent and rebuilds
// children from scratch. This is the property `BattleRenderer.
// redrawStaticLayers()` depends on for WebGL context-loss recovery —
// after a context-loss-then-restore cycle, the Pixi Text objects'
// GPU-side bitmaps are gone but the layer's `container.children` still
// holds the stale references; a fresh `draw()` call must replace them
// cleanly without leaking the old instances and without surfacing a
// transient "no children" state mid-rebuild.
describe('ElevationLabelLayer — context-loss redraw idempotency', () => {
  function makeMap(tiles: ReadonlyArray<{ x: number; y: number; elev: number }>): BattleMap {
    return {
      width: 3,
      height: 3,
      tiles: tiles.map(({ x, y, elev }) => ({
        x,
        y,
        layer: 0,
        terrain: 'ground',
        elevation: elev,
      } as Tile)),
    } as BattleMap;
  }

  it('repaints one label per tile after a second draw() call', () => {
    const layer = new ElevationLabelLayer();
    const map = makeMap([
      { x: 0, y: 0, elev: 2 },
      { x: 1, y: 0, elev: 5 },
      { x: 2, y: 0, elev: 8 },
    ]);

    layer.draw(map);
    expect(layer.container.children).toHaveLength(3);

    // Simulate the context-loss-then-restore cycle: caller invokes
    // draw() a second time against the same map. The layer's
    // implementation clears old children before adding new ones; the
    // post-redraw count must still be the tile count (no doubling, no
    // ghost children).
    layer.draw(map);
    expect(layer.container.children).toHaveLength(3);
  });

  it('does not leak old Text instances across redraws (children replaced, not appended)', () => {
    const layer = new ElevationLabelLayer();
    const map = makeMap([{ x: 0, y: 0, elev: 4 }]);

    layer.draw(map);
    const firstPassChild = layer.container.children[0];
    expect(firstPassChild).toBeDefined();

    layer.draw(map);
    // After redraw, the original Text instance must be gone from the
    // container — a real Pixi Text from a lost-context Pixi app would
    // still render as an empty bitmap. The replace-not-append property
    // is what makes redrawStaticLayers() actually restore visuals.
    expect(layer.container.children).not.toContain(firstPassChild);
    expect(layer.container.children).toHaveLength(1);
  });
});
