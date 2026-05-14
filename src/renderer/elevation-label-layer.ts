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
  ELEVATION_LABEL_COLOR,
  ELEVATION_LABEL_FONT_SIZE,
  ELEVATION_LABEL_OUTLINE,
  ELEVATION_LABEL_OUTLINE_WIDTH,
  ELEVATION_LABEL_PADDING,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

// Returns the elevation label string for a tile elevation. Every tile
// is labelled — there is no threshold. Exposed for unit tests.
export function elevationLabelFor(elevation: number): string {
  return String(elevation);
}

export class ElevationLabelLayer {
  readonly container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'elevation-labels';
  }

  // Render elevation labels for the given map. Called once at mount;
  // labels are static for the lifetime of the map. If a future ability
  // mutates elevation mid-battle, callers can re-invoke `draw`.
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
      fill: ELEVATION_LABEL_COLOR,
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
