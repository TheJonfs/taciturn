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
// The layer is stateless externally: callers pass a fresh set of
// positions and a kind on each `setBase`/`setOverlay`; the layer clears
// and redraws the corresponding graphics. v1 only — content authoring
// of richer overlays (animated outlines, gradient fills) is a polish-
// pass concern.

import { Container, Graphics, Text } from 'pixi.js';
import type { Position } from '@engine/index.ts';
import {
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_OVERLAY_ALPHA,
  HIGHLIGHT_STROKE_ALPHA,
  HIGHLIGHT_STROKE_WIDTH,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export type HighlightKind = 'move' | 'attack' | 'heal' | 'aoe' | 'none';

// Session 55: one tile of a Worldcraft elevation-kernel preview — its
// position and the per-tile elevation delta the cast would apply (+ raises,
// − lowers). Drives the Hill/Valley (and Pillar/Pit) hover preview.
export interface KernelCell {
  readonly position: Position;
  readonly delta: number;
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

  // Replace the base highlight set. Pass `kind: 'none'` or an empty
  // array to clear.
  setBase(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    drawHighlights(this.baseGfx, positions, kind, HIGHLIGHT_ALPHA);
  }

  // Replace the overlay highlight set (drawn on top of base). Pass
  // `kind: 'none'` or an empty array to clear. Used for AoE preview
  // on hover and currently-hovered-target accenting.
  setOverlay(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    drawHighlights(this.overlayGfx, positions, kind, HIGHLIGHT_OVERLAY_ALPHA);
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
    const size = TILE_SIZE - TILE_INSET;
    for (const { position: p, delta } of cells) {
      if (delta === 0) continue;
      const px = p.x * TILE_SIZE + TILE_INSET / 2;
      const py = p.y * TILE_SIZE + TILE_INSET / 2;
      const color = delta > 0 ? HIGHLIGHT_COLORS.heal : HIGHLIGHT_COLORS.attack;
      // Alpha scales with magnitude so the center (±3/±4) reads stronger than
      // the corners (±1) — the kernel's "shape" is legible at a glance.
      const alpha = Math.min(HIGHLIGHT_OVERLAY_ALPHA, 0.18 + 0.12 * Math.abs(delta));
      this.kernelGfx.rect(px, py, size, size);
      this.kernelGfx.fill({ color, alpha });
      this.kernelGfx.stroke({ color, alpha: HIGHLIGHT_STROKE_ALPHA, width: HIGHLIGHT_STROKE_WIDTH });
      this.kernelText.addChild(buildKernelLabel(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, px, py, size));
    }
  }

  clear(): void {
    this.baseGfx.clear();
    this.overlayGfx.clear();
    this.setKernelOverlay([]);
  }
}

function buildKernelLabel(label: string, px: number, py: number, size: number): Text {
  const text = new Text({
    text: label,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: Math.round(size * 0.4),
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3, join: 'round' },
      align: 'center',
    },
  });
  text.anchor.set(0.5);
  text.x = px + size / 2;
  text.y = py + size / 2;
  return text;
}

function drawHighlights(
  g: Graphics,
  positions: ReadonlyArray<Position>,
  kind: HighlightKind,
  alpha: number,
): void {
  g.clear();
  if (kind === 'none' || positions.length === 0) return;
  const color = HIGHLIGHT_COLORS[kind];
  for (const p of positions) {
    const px = p.x * TILE_SIZE + TILE_INSET / 2;
    const py = p.y * TILE_SIZE + TILE_INSET / 2;
    const size = TILE_SIZE - TILE_INSET;
    g.rect(px, py, size, size);
    g.fill({ color, alpha });
    // Stroke outline gives a hard edge that reads against any terrain
    // texture, including the new grass overlay (session 26.5 polish).
    g.stroke({ color, alpha: HIGHLIGHT_STROKE_ALPHA, width: HIGHLIGHT_STROKE_WIDTH });
  }
}
