import { describe, expect, it } from 'vitest';
import { elevationLabelColor, elevationLabelFor } from './elevation-label-layer.ts';
import {
  ELEVATION_LABEL_COLOR_HIGH,
  ELEVATION_LABEL_COLOR_LOW,
  ELEVATION_LABEL_SATURATION_ELEV,
} from './constants.ts';

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
