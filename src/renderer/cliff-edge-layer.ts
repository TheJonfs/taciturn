// Cliff-edge overlay layer — draws a darkened strip on a tile's edge
// when an adjacent cardinal neighbor has lower elevation. Per ADR-0072
// (Session 32), this is a rendering-only substrate that makes the
// height variance on maps with elevation (e.g. River Ridge in S33)
// readable at a glance. Training Field's uniform elevation produces
// zero strips, so the existing demo is unaffected.
//
// Layer placement: sits between TileLayer and HighlightLayer so cliff
// faces appear "on" the tile but under any move/attack-range
// highlighting. The renderer reads only the BattleMap (no engine
// state) and is engine-blind.
//
// Algorithm:
//   For each tile t:
//     For each cardinal neighbor n (N, S, E, W):
//       If n exists and n.elevation < t.elevation:
//         Determine thickness from delta (categorical: 1px/2px/3px).
//         Determine color from terrain palette (darken_shadow for S/E
//         edges; darken_highlight for N/W edges — the upper-left-lit
//         convention).
//         Draw a strip along t's edge facing n, at the outer rect
//         (inset by TILE_INSET like the tile's fill, then offset by
//         thickness for the inward draw).
//
// The cliff strips draw *inward* from the tile's edge: a strip on
// the south edge of a tile occupies the bottom `thickness` pixels of
// that tile's rendered footprint. Pre-S32 the renderer wouldn't tell
// you a tile sat 6 elevation higher than its neighbor; with cliff
// edges, the player reads "this tile rises here" without consulting
// the tile-info panel.

import { Container, Graphics } from 'pixi.js';
import type { BattleMap, Tile } from '@engine/index.ts';
import {
  CLIFF_EDGE_DARKEN_HIGHLIGHT,
  CLIFF_EDGE_DARKEN_SHADOW,
  CLIFF_EDGE_THICKNESS_PX_DELTA_1,
  CLIFF_EDGE_THICKNESS_PX_DELTA_2_3,
  CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS,
  TERRAIN_COLORS,
  TERRAIN_FALLBACK_COLOR,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

// Cardinal direction tag for the four edges of a tile.
export type CliffEdgeSide = 'N' | 'S' | 'E' | 'W';

// Per ADR-0072 — categorical thickness scaling. Δ=1 → 1px; Δ=2-3 → 2px;
// Δ≥4 → 3px. Exposed for unit tests.
export function cliffEdgeThicknessFor(elevationDelta: number): number {
  if (elevationDelta <= 0) return 0;
  if (elevationDelta === 1) return CLIFF_EDGE_THICKNESS_PX_DELTA_1;
  if (elevationDelta <= 3) return CLIFF_EDGE_THICKNESS_PX_DELTA_2_3;
  return CLIFF_EDGE_THICKNESS_PX_DELTA_4_PLUS;
}

// Categorize edges per the upper-left-lit convention. N and W edges
// catch more light (lighter darken); S and E edges sit in shadow (
// heavier darken). Exposed for unit tests.
export function cliffEdgeDarkenFactorFor(side: CliffEdgeSide): number {
  return side === 'N' || side === 'W'
    ? CLIFF_EDGE_DARKEN_HIGHLIGHT
    : CLIFF_EDGE_DARKEN_SHADOW;
}

// Multiplicative darken on a 0xRRGGBB int. Each channel is scaled by
// `factor`; clamped to [0, 255] per channel. Exposed for unit tests.
export function darkenColor(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.floor(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.floor(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.floor((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

// Get the terrain palette color for a tile; fallback to the
// well-known debug magenta if the terrain has no entry.
function paletteColorFor(tile: Tile): number {
  return TERRAIN_COLORS[tile.terrain] ?? TERRAIN_FALLBACK_COLOR;
}

const CARDINAL_OFFSETS: ReadonlyArray<{
  readonly side: CliffEdgeSide;
  readonly dx: number;
  readonly dy: number;
}> = [
  { side: 'N', dx: 0, dy: -1 },
  { side: 'S', dx: 0, dy: 1 },
  { side: 'E', dx: 1, dy: 0 },
  { side: 'W', dx: -1, dy: 0 },
];

// Look up the tile at (x, y) on the given layer. Map authoring is
// single-layer in v1 (River Ridge); the layer scan is a small
// future-proof for multi-layer maps. Returns the first match.
function tileAt(map: BattleMap, x: number, y: number, layer: number): Tile | undefined {
  for (const t of map.tiles) {
    if (t.x === x && t.y === y && t.layer === layer) return t;
  }
  return undefined;
}

export class CliffEdgeLayer {
  readonly container: Container;
  private readonly graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'cliff-edges';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  // Render cliff strips for the given map. Called once at mount; the
  // strips are static for the lifetime of the map. If a future ability
  // mutates elevation mid-battle, the renderer can call `draw` again
  // to repaint.
  draw(map: BattleMap): void {
    const g = this.graphics;
    g.clear();

    for (const tile of map.tiles) {
      const tileColor = paletteColorFor(tile);
      const tilePxX = tile.x * TILE_SIZE + TILE_INSET / 2;
      const tilePxY = tile.y * TILE_SIZE + TILE_INSET / 2;
      const tilePxSize = TILE_SIZE - TILE_INSET;

      for (const { side, dx, dy } of CARDINAL_OFFSETS) {
        const neighbor = tileAt(map, tile.x + dx, tile.y + dy, tile.layer);
        // Edge of map: no neighbor → no cliff (the off-map space is
        // visually undefined). Future maps could opt into a "world
        // boundary" cliff treatment; not v1.
        if (neighbor === undefined) continue;
        const delta = tile.elevation - neighbor.elevation;
        if (delta <= 0) continue;
        const thickness = cliffEdgeThicknessFor(delta);
        if (thickness <= 0) continue;
        const color = darkenColor(tileColor, cliffEdgeDarkenFactorFor(side));

        // Draw the strip inside the tile's footprint along the edge
        // facing the lower neighbor. Strips draw inward — the south
        // edge of a tile occupies the bottom `thickness` pixels.
        switch (side) {
          case 'N':
            g.rect(tilePxX, tilePxY, tilePxSize, thickness);
            break;
          case 'S':
            g.rect(tilePxX, tilePxY + tilePxSize - thickness, tilePxSize, thickness);
            break;
          case 'W':
            g.rect(tilePxX, tilePxY, thickness, tilePxSize);
            break;
          case 'E':
            g.rect(tilePxX + tilePxSize - thickness, tilePxY, thickness, tilePxSize);
            break;
        }
        g.fill({ color, alpha: 1 });
      }
    }
  }
}
