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

import { Container, Graphics } from 'pixi.js';
import type { Position } from '@engine/index.ts';
import {
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_OVERLAY_ALPHA,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export type HighlightKind = 'move' | 'attack' | 'heal' | 'aoe' | 'none';

export class HighlightLayer {
  readonly container: Container;
  private readonly baseGfx: Graphics;
  private readonly overlayGfx: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'highlights';
    this.baseGfx = new Graphics();
    this.overlayGfx = new Graphics();
    this.container.addChild(this.baseGfx, this.overlayGfx);
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

  clear(): void {
    this.baseGfx.clear();
    this.overlayGfx.clear();
  }
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
  }
}
