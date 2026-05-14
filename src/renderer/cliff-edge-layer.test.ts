// Unit tests for cliff-edge rendering helpers. The Pixi rendering side
// (Graphics calls) isn't tested headlessly — the renderer's other layers
// don't have snapshot tests either. The pure helper functions (
// thickness scaling, color darkening, edge categorization) carry the
// design-doc-fixed values so a regression in the categorical scaling
// trips a focused failure.

import {
  cliffEdgeDarkenFactorFor,
  cliffEdgeThicknessFor,
  darkenColor,
} from './cliff-edge-layer.ts';
import {
  CLIFF_EDGE_DARKEN_HIGHLIGHT,
  CLIFF_EDGE_DARKEN_SHADOW,
  CLIFF_EDGE_THICKNESS_PX_DELTA_1,
  CLIFF_EDGE_THICKNESS_PX_DELTA_2_3,
  CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS,
} from './constants.ts';

describe('cliffEdgeThicknessFor — categorical scaling (ADR-0072)', () => {
  it('returns 0 for zero or negative delta (no cliff)', () => {
    expect(cliffEdgeThicknessFor(0)).toBe(0);
    expect(cliffEdgeThicknessFor(-1)).toBe(0);
    expect(cliffEdgeThicknessFor(-10)).toBe(0);
  });

  // Session 33.5: bins bumped from 1/2/3px to 2/3/5px per Chris's River
  // Ridge playtest read (the original strips were too subtle at 48px).
  it('returns 2px for Δ=1 (gentle 1-step rise along a ridge)', () => {
    expect(cliffEdgeThicknessFor(1)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_1);
    expect(cliffEdgeThicknessFor(1)).toBe(2);
  });

  it('returns 3px for Δ=2 and Δ=3 (moderate climb)', () => {
    expect(cliffEdgeThicknessFor(2)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_2_3);
    expect(cliffEdgeThicknessFor(3)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_2_3);
    expect(cliffEdgeThicknessFor(2)).toBe(3);
    expect(cliffEdgeThicknessFor(3)).toBe(3);
  });

  it('returns 5px for Δ≥4 (sharp drop — high-perch off-the-ridge)', () => {
    expect(cliffEdgeThicknessFor(4)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS);
    expect(cliffEdgeThicknessFor(7)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS);
    expect(cliffEdgeThicknessFor(99)).toBe(CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS);
    expect(cliffEdgeThicknessFor(4)).toBe(5);
  });
});

describe('cliffEdgeDarkenFactorFor — upper-left-lit convention (ADR-0072)', () => {
  it('returns the lighter darken for N and W edges (lit side)', () => {
    expect(cliffEdgeDarkenFactorFor('N')).toBe(CLIFF_EDGE_DARKEN_HIGHLIGHT);
    expect(cliffEdgeDarkenFactorFor('W')).toBe(CLIFF_EDGE_DARKEN_HIGHLIGHT);
  });

  it('returns the heavier darken for S and E edges (shadowed side)', () => {
    expect(cliffEdgeDarkenFactorFor('S')).toBe(CLIFF_EDGE_DARKEN_SHADOW);
    expect(cliffEdgeDarkenFactorFor('E')).toBe(CLIFF_EDGE_DARKEN_SHADOW);
  });

  it('shadow darken is heavier (smaller factor) than highlight', () => {
    expect(CLIFF_EDGE_DARKEN_SHADOW).toBeLessThan(CLIFF_EDGE_DARKEN_HIGHLIGHT);
  });
});

describe('darkenColor — multiplicative RGB scaling', () => {
  it('scales each channel by the factor (rounded down)', () => {
    // 0x40 = 64; 64 × 0.5 = 32 = 0x20.
    expect(darkenColor(0x404040, 0.5)).toBe(0x202020);
  });

  it('clamps below at 0 (factor of 0 → black)', () => {
    expect(darkenColor(0xff8040, 0)).toBe(0x000000);
  });

  it('clamps above at 255 (factor > 1 saturates)', () => {
    // 0x80 × 2 = 256 → clamps to 255 (0xff). All three channels saturate.
    expect(darkenColor(0x808080, 2)).toBe(0xffffff);
  });

  it('preserves color identity with factor of 1', () => {
    expect(darkenColor(0x4a5b3c, 1)).toBe(0x4a5b3c);
  });

  it('grass-tile shadow darken — matches the production constant', () => {
    // 0x4a5b3c is TERRAIN_COLORS.ground. With CLIFF_EDGE_DARKEN_SHADOW (~0.55),
    // the cliff-strip color reads as a much darker green. Calculation:
    //   R: 0x4a (74) × 0.55 = 40 → 0x28
    //   G: 0x5b (91) × 0.55 = 50 → 0x32
    //   B: 0x3c (60) × 0.55 = 33 → 0x21
    expect(darkenColor(0x4a5b3c, CLIFF_EDGE_DARKEN_SHADOW)).toBe(0x283221);
  });
});
