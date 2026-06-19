// Tile layer — draws the battle map.
//
// Two-pass rendering per ADR-0054:
//
//   1. The Graphics fallback (`draw(map)`): every tile gets a colored
//      rect keyed off `TERRAIN_COLORS[terrain]`. This pass runs once at
//      mount and provides the always-available visual; no asset load
//      blocks first paint.
//
//   2. The texture overlay (`applyTerrainTextures(...)`): once
//      BattleRenderer's async terrain loader resolves a terrain type's
//      pool, it calls back into TileLayer with the cached `Texture`s.
//      For each tile of that terrain, a Sprite covering the rect is
//      added on top. Tiles whose terrain has no manifest entry stay
//      bare (the rect shows through).
//
// Per-tile variant selection is deterministic: the renderer threads the
// battle's `masterSeed` into `pickTerrainVariantIndex(seed, x, y, n)`
// (see `assets/terrain/index.ts`). Same seed + same map → same per-
// tile picks across reloads, replays, and (eventually) network-shared
// battles.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { BattleMap, TerrainType } from '@engine/index.ts';
import { pickTerrainVariantIndex } from '../assets/terrain/index.ts';
import {
  TERRAIN_COLORS,
  TERRAIN_FALLBACK_COLOR,
  TERRAIN_TINT_DEFAULT,
  TERRAIN_TINTS,
  TILE_INSET,
  TILE_OUTLINE_ALPHA,
  TILE_OUTLINE_COLOR,
  TILE_SIZE,
} from './constants.ts';

export class TileLayer {
  readonly container: Container;
  private readonly graphics: Graphics;
  // Texture overlay container. Sits above `graphics` in the layer
  // hierarchy so loaded textures cover the colored rects. Cleared and
  // re-populated by `applyTerrainTextures`; before that runs (or for
  // terrains without manifest entries) it stays empty and the rects
  // show.
  private readonly overlay: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'tiles';
    this.graphics = new Graphics();
    this.overlay = new Container();
    this.overlay.label = 'tile-overlay';
    this.container.addChild(this.graphics);
    this.container.addChild(this.overlay);
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

  // Overlay loaded terrain textures. Per-tile variant pick is
  // deterministic from `masterSeed` so the same battle replays
  // identically. Called incrementally (once per terrain type that
  // finishes loading): each call replaces any prior overlay for the
  // affected terrain type, leaving other terrains' overlays alone.
  //
  // Sprite sizing follows the rect's inset bounds, so the texture
  // covers the colored fill exactly without leaking into adjacent
  // tiles. The texture's intrinsic resolution can be larger than the
  // rendered size — Pixi handles the downscale via mipmap.
  applyTerrainTextures(
    map: BattleMap,
    terrainType: TerrainType,
    textures: ReadonlyArray<Texture>,
    masterSeed: number,
  ): void {
    if (textures.length === 0) return;
    // Remove any existing sprites of this terrain so re-applying after
    // a HMR or content swap doesn't pile up duplicates. Sprites are
    // labeled with their terrain type for cheap removal.
    for (const child of [...this.overlay.children]) {
      if (child.label === `tile-${terrainType}`) {
        this.overlay.removeChild(child);
        child.destroy();
      }
    }
    const size = TILE_SIZE - TILE_INSET;
    const tint = TERRAIN_TINTS[terrainType] ?? TERRAIN_TINT_DEFAULT;
    for (const tile of map.tiles) {
      if (tile.terrain !== terrainType) continue;
      const idx = pickTerrainVariantIndex(masterSeed, tile.x, tile.y, textures.length);
      const texture = textures[idx];
      if (texture === undefined) continue;
      const sprite = new Sprite(texture);
      sprite.label = `tile-${terrainType}`;
      sprite.x = tile.x * TILE_SIZE + TILE_INSET / 2;
      sprite.y = tile.y * TILE_SIZE + TILE_INSET / 2;
      // Fill the tile square on both axes. Scaling by a single dimension
      // (the old `max(w, h)`) only covered the tile when the texture was
      // square; a non-square variant (e.g. S70's 256×139 rock) left the
      // grey fallback rect showing through the uncovered strip. Per-axis
      // scale stretches any aspect ratio to fill exactly — terrain
      // textures tolerate the slight stretch better than a grey gap.
      sprite.scale.set(
        size / Math.max(texture.width, 1),
        size / Math.max(texture.height, 1),
      );
      if (tint !== TERRAIN_TINT_DEFAULT) sprite.tint = tint;
      this.overlay.addChild(sprite);
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
