// Highlight layer — draws translucent overlays on tiles to communicate
// UI selection state (legal move destinations, valid attack targets,
// AoE preview, etc.). Drawn between the tile layer and the unit layer
// so highlights sit on top of terrain but under sprites.
//
// Two channels: `base` (legal targets / reachable destinations) and
// `overlay` (AoE preview / currently-hovered target). The overlay is
// drawn on top of base with a brighter alpha, so a tile that's both a
// legal target and inside the hovered AoE footprint reads as the
// brighter overlay color. Either channel can be cleared independently.
//
// S97 (stacked cells): highlight geometry is per-LAYER, not per-cell.
// A position on a stacked cell's lifted deck paints the lifted rect; a
// position on the covered ground paints only the bottom sliver the lift
// leaves visible. An AoE that hits both layers (the vertical-tolerance
// rule) therefore lights both areas distinctly instead of one merged
// cell. The layer reads the shared `StackGeometry` (set at mount /
// map-mutation) so its geometry can never disagree with the tile art.
//
// The layer is stateless externally: callers pass a fresh set of
// positions and a kind on each `setBase`/`setOverlay`; the layer clears
// and redraws the corresponding graphics. v1 only — content authoring
// of richer overlays (animated outlines, gradient fills) is a polish-
// pass concern.

import { Container, Graphics, Text } from 'pixi.js';
import type { Position } from '@engine/index.ts';
import { intersectRect, type PixelRect, type StackGeometry } from './world.ts';
import {
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_OVERLAY_ALPHA,
  HIGHLIGHT_STROKE_ALPHA,
  HIGHLIGHT_STROKE_WIDTH,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export type HighlightKind = 'move' | 'attack' | 'heal' | 'aoe' | 'target' | 'none';

// Session 55: one tile of a Worldcraft elevation-kernel preview — its
// position and the per-tile elevation delta the cast would apply (+ raises,
// − lowers). Drives the Hill/Valley (and Pillar/Pit) hover preview.
export interface KernelCell {
  readonly position: Position;
  readonly delta: number;
}

// The pixel rects a highlight for `p` should paint: the lifted rect
// for a stacked cell's deck, the visible sliver strips (clipped to the
// inset footprint) for its covered ground, the plain inset footprint
// otherwise.
function highlightRects(p: Position, geo: StackGeometry | null): ReadonlyArray<PixelRect> {
  const px = p.x * TILE_SIZE + TILE_INSET / 2;
  const py = p.y * TILE_SIZE + TILE_INSET / 2;
  const size = TILE_SIZE - TILE_INSET;
  const footprint: PixelRect = { px, py, w: size, h: size };
  if (geo !== null) {
    const lift = geo.liftFor(p);
    if (lift > 0) return [{ px: px - lift, py: py - lift, w: size, h: size }];
    if (geo.isCoveredGround(p)) {
      const rects: PixelRect[] = [];
      for (const r of geo.visibleGroundRects(p.x, p.y)) {
        const clipped = intersectRect(r, footprint);
        if (clipped !== null) rects.push(clipped);
      }
      if (rects.length > 0) return rects;
    }
  }
  return [footprint];
}

export class HighlightLayer {
  readonly container: Container;
  private readonly baseGfx: Graphics;
  private readonly overlayGfx: Graphics;
  // Session 55: Worldcraft kernel-preview channel — per-tile tint (by delta
  // magnitude) plus a numeric label. Its own Graphics + Text container sit
  // above the overlay so the +3/−2 labels read on top of everything.
  private readonly kernelGfx: Graphics;
  private readonly kernelText: Container;
  // S97: stacked-cell geometry, set at mount and on map mutation. Null
  // (single-layer map / pre-mount) → every rect is the plain footprint.
  private geo: StackGeometry | null = null;
  // Last-drawn inputs per channel, retained so a geometry swap (bridge
  // destroyed mid-battle) can repaint in-flight highlights against the
  // new stack shapes.
  private lastBase: { positions: ReadonlyArray<Position>; kind: HighlightKind } = { positions: [], kind: 'none' };
  private lastOverlay: { positions: ReadonlyArray<Position>; kind: HighlightKind } = { positions: [], kind: 'none' };

  constructor() {
    this.container = new Container();
    this.container.label = 'highlights';
    this.baseGfx = new Graphics();
    this.overlayGfx = new Graphics();
    this.kernelGfx = new Graphics();
    this.kernelText = new Container();
    this.kernelText.label = 'kernel-labels';
    this.container.addChild(this.baseGfx, this.overlayGfx, this.kernelGfx, this.kernelText);
  }

  // S97: swap the stacked-cell geometry (mount / map mutation) and
  // repaint both channels against it.
  setStackGeometry(geo: StackGeometry | null): void {
    this.geo = geo;
    this.drawChannel(this.baseGfx, this.lastBase.positions, this.lastBase.kind, HIGHLIGHT_ALPHA);
    this.drawChannel(this.overlayGfx, this.lastOverlay.positions, this.lastOverlay.kind, HIGHLIGHT_OVERLAY_ALPHA);
  }

  // Replace the base highlight set. Pass `kind: 'none'` or an empty
  // array to clear.
  setBase(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    this.lastBase = { positions, kind };
    this.drawChannel(this.baseGfx, positions, kind, HIGHLIGHT_ALPHA);
  }

  // Replace the overlay highlight set (drawn on top of base). Pass
  // `kind: 'none'` or an empty array to clear. Used for AoE preview
  // on hover and currently-hovered-target accenting.
  setOverlay(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    this.lastOverlay = { positions, kind };
    this.drawChannel(this.overlayGfx, positions, kind, HIGHLIGHT_OVERLAY_ALPHA);
  }

  // Session 55: replace the Worldcraft kernel preview. Each cell is tinted by
  // its delta magnitude (raise → green, lower → attack-red) with a numeric
  // overlay (+3 / −2 / …) at the tile centre. Pass an empty array to clear.
  setKernelOverlay(cells: ReadonlyArray<KernelCell>): void {
    this.kernelGfx.clear();
    for (const child of [...this.kernelText.children]) {
      this.kernelText.removeChild(child);
      child.destroy();
    }
    for (const { position: p, delta } of cells) {
      if (delta === 0) continue;
      const rects = highlightRects(p, this.geo);
      const color = delta > 0 ? HIGHLIGHT_COLORS.heal : HIGHLIGHT_COLORS.attack;
      // Alpha scales with magnitude so the center (±3/±4) reads stronger than
      // the corners (±1) — the kernel's "shape" is legible at a glance.
      const alpha = Math.min(HIGHLIGHT_OVERLAY_ALPHA, 0.18 + 0.12 * Math.abs(delta));
      for (const { px, py, w, h } of rects) {
        this.kernelGfx.rect(px, py, w, h);
        this.kernelGfx.fill({ color, alpha });
        this.kernelGfx.stroke({ color, alpha: HIGHLIGHT_STROKE_ALPHA, width: HIGHLIGHT_STROKE_WIDTH });
      }
      // Label centers on the first (largest-relevance) rect.
      const first = rects[0]!;
      this.kernelText.addChild(
        buildKernelLabel(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, first.px, first.py, first.w, first.h),
      );
    }
  }

  clear(): void {
    this.setBase([], 'none');
    this.setOverlay([], 'none');
    this.setKernelOverlay([]);
  }

  private drawChannel(
    g: Graphics,
    positions: ReadonlyArray<Position>,
    kind: HighlightKind,
    alpha: number,
  ): void {
    g.clear();
    if (kind === 'none' || positions.length === 0) return;
    const color = HIGHLIGHT_COLORS[kind];
    for (const p of positions) {
      for (const { px, py, w, h } of highlightRects(p, this.geo)) {
        g.rect(px, py, w, h);
        g.fill({ color, alpha });
        // Stroke outline gives a hard edge that reads against any terrain
        // texture, including the new grass overlay (session 26.5 polish).
        g.stroke({ color, alpha: HIGHLIGHT_STROKE_ALPHA, width: HIGHLIGHT_STROKE_WIDTH });
      }
    }
  }
}

function buildKernelLabel(label: string, px: number, py: number, w: number, h: number): Text {
  const text = new Text({
    text: label,
    style: {
      fontFamily: 'system-ui, sans-serif',
      // Sized against the full tile even when the rect is a sliver —
      // a sliver-scaled digit would be illegible; the outline keeps it
      // readable where it overlaps the deck art above.
      fontSize: Math.round((TILE_SIZE - TILE_INSET) * 0.4),
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3, join: 'round' },
      align: 'center',
    },
  });
  text.anchor.set(0.5);
  text.x = px + w / 2;
  text.y = py + h / 2;
  return text;
}
