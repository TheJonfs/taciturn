// Tile layer — draws the battle map as flat colored squares.
// Built once when the renderer mounts; redraw is unnecessary for v1
// because maps don't mutate during a battle.

import { Container, Graphics } from 'pixi.js';
import type { BattleMap } from '@engine/index.ts';
import {
  TERRAIN_COLORS,
  TERRAIN_FALLBACK_COLOR,
  TILE_INSET,
  TILE_OUTLINE_ALPHA,
  TILE_OUTLINE_COLOR,
  TILE_SIZE,
} from './constants.ts';

export class TileLayer {
  readonly container: Container;
  private readonly graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'tiles';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  draw(map: BattleMap): void {
    const g = this.graphics;
    g.clear();

    // Group tiles by layer so higher layers draw on top of lower ones.
    const byLayer: ReadonlyMap<number, typeof map.tiles> = groupByLayer(map);
    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const layer of sortedLayers) {
      const tiles = byLayer.get(layer);
      if (tiles === undefined) continue;
      for (const tile of tiles) {
        const color = TERRAIN_COLORS[tile.terrain] ?? TERRAIN_FALLBACK_COLOR;
        const px = tile.x * TILE_SIZE + TILE_INSET / 2;
        const py = tile.y * TILE_SIZE + TILE_INSET / 2;
        const size = TILE_SIZE - TILE_INSET;
        g.rect(px, py, size, size);
        g.fill(color);
        g.stroke({ color: TILE_OUTLINE_COLOR, alpha: TILE_OUTLINE_ALPHA, width: 1 });
      }
    }
  }
}

function groupByLayer(map: BattleMap): Map<number, typeof map.tiles> {
  const out = new Map<number, (typeof map.tiles)[number][]>();
  for (const tile of map.tiles) {
    const list = out.get(tile.layer);
    if (list === undefined) {
      out.set(tile.layer, [tile]);
    } else {
      list.push(tile);
    }
  }
  return out;
}
