// Highlight layer — draws translucent overlays on tiles to communicate
// UI selection state (legal move destinations, valid attack targets,
// AoE preview, etc.). Drawn between the tile layer and the unit layer
// so highlights sit on top of terrain but under sprites.
//
// The layer is stateless externally: callers pass a fresh set of
// positions and a kind on each `set()`; the layer clears and redraws.
// v1 only — content authoring of richer overlays (animated outlines,
// gradient fills) is a polish-pass concern.

import { Container, Graphics } from 'pixi.js';
import type { Position } from '@engine/index.ts';
import {
  HIGHLIGHT_ALPHA,
  HIGHLIGHT_COLORS,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export type HighlightKind = 'move' | 'attack' | 'heal' | 'aoe' | 'none';

export class HighlightLayer {
  readonly container: Container;
  private readonly graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'highlights';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  // Replace the highlight set. Pass `kind: 'none'` or an empty array to
  // clear. Re-rendering is cheap relative to the tile layer because
  // highlight sets are typically small (~20 tiles for a Move range).
  set(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    const g = this.graphics;
    g.clear();
    if (kind === 'none' || positions.length === 0) return;

    const color = HIGHLIGHT_COLORS[kind];
    for (const p of positions) {
      const px = p.x * TILE_SIZE + TILE_INSET / 2;
      const py = p.y * TILE_SIZE + TILE_INSET / 2;
      const size = TILE_SIZE - TILE_INSET;
      g.rect(px, py, size, size);
      g.fill({ color, alpha: HIGHLIGHT_ALPHA });
    }
  }

  clear(): void {
    this.graphics.clear();
  }
}
