// Elevation-label layer — small numeric per-tile readout of the
// elevation in the top-right corner. Session 33 (replaces the earlier
// pip-stack design mid-session; companion to the cliff-edge layer per
// ADR-0072).
//
// Where cliff edges show *that* two tiles differ in elevation, the
// label shows *the exact elevation* of each tile. Players read the
// digit at a glance — no need to count pips or interpret tiers.
//
// Labelling rule: every tile gets a label, including water (elev 0/1)
// and baseline ground (elev 2). The uniform readout means a player
// never has to guess whether an unlabelled tile is "baseline" or just
// missing a marker — the digit is always there.
//
// Layer placement: above cliff-edge, below highlight. Same as the prior
// pip-stack layer (kept by the renderer in the same z-position).
//
// Engine-blind: reads only BattleMap (no GameState, no Catalog). Static
// for the map's lifetime; a future elevation-mutation ability would
// re-call `draw` to repaint.

import { Container, Text } from 'pixi.js';
import type { BattleMap, Tile } from '@engine/index.ts';
import {
  ELEVATION_LABEL_COLOR_HIGH,
  ELEVATION_LABEL_COLOR_LOW,
  ELEVATION_LABEL_FONT_SIZE,
  ELEVATION_LABEL_OUTLINE,
  ELEVATION_LABEL_OUTLINE_WIDTH,
  ELEVATION_LABEL_PADDING,
  ELEVATION_LABEL_SATURATION_ELEV,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

// Returns the elevation label string for a tile elevation. Every tile
// is labelled — there is no threshold. Exposed for unit tests.
export function elevationLabelFor(elevation: number): string {
  return String(elevation);
}

// Linear-RGB interpolation between two 0xRRGGBB ints at parameter
// `t` ∈ [0, 1].
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// Fill color for an elevation label: a two-hue cyan→gold ramp. Clamps
// to the LOW color at elevation 0 and the HIGH color at (and above)
// the saturation elevation. Exposed for unit tests.
export function elevationLabelColor(elevation: number): number {
  const t = Math.max(0, Math.min(1, elevation / ELEVATION_LABEL_SATURATION_ELEV));
  return lerpColor(ELEVATION_LABEL_COLOR_LOW, ELEVATION_LABEL_COLOR_HIGH, t);
}

export class ElevationLabelLayer {
  readonly container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'elevation-labels';
  }

  // Render elevation labels for the given map. Called once at mount;
  // labels are static for the lifetime of the map. If a future ability
  // mutates elevation mid-battle, callers can re-invoke `draw`. Also
  // called from `BattleRenderer.redrawStaticLayers()` on WebGL context
  // restore (S50 fix).
  //
  // S94 fix (revises the S50 mitigation): plain `destroy()` — NEVER
  // `{ texture: true, textureSource: true }` on canvas Text. A canvas
  // Text's texture is POOL-MANAGED by Pixi's CanvasTextSystem (reference
  // counting + texture GC): destroying it directly here and letting the
  // system return it to the TexturePool on unload is a double-free that
  // corrupts the pool bucket — the playtest crash at
  // `TexturePool.returnTexture: cannot read 'push' of undefined`. The
  // pool + GC already reclaim the bitmap after a plain destroy, so the
  // S50 leak concern is covered by Pixi's own lifecycle.
  draw(map: BattleMap): void {
    // Clear any previous labels first (supports repaints).
    for (const child of [...this.container.children]) {
      this.container.removeChild(child);
      child.destroy();
    }
    for (const tile of map.tiles) {
      const label = elevationLabelFor(tile.elevation);
      this.container.addChild(buildLabel(tile, label));
    }
  }
}

function buildLabel(tile: Tile, label: string): Text {
  const text = new Text({
    text: label,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: ELEVATION_LABEL_FONT_SIZE,
      fontWeight: 'bold',
      fill: elevationLabelColor(tile.elevation),
      stroke: {
        color: ELEVATION_LABEL_OUTLINE,
        width: ELEVATION_LABEL_OUTLINE_WIDTH,
        join: 'round',
      },
      align: 'right',
    },
  });
  // Anchor at top-right (1, 0); position at the tile's top-right
  // corner inset by ELEVATION_LABEL_PADDING.
  text.anchor.set(1, 0);
  const tilePxX = tile.x * TILE_SIZE + TILE_INSET / 2;
  const tilePxY = tile.y * TILE_SIZE + TILE_INSET / 2;
  const tilePxSize = TILE_SIZE - TILE_INSET;
  text.x = tilePxX + tilePxSize - ELEVATION_LABEL_PADDING;
  text.y = tilePxY + ELEVATION_LABEL_PADDING;
  return text;
}
