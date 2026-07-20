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
// S97 (bridge over/under UI): stacked cells draw in two passes. The
// base pass holds every tile that is NOT a lifted deck (including the
// covered ground tile of a stack, drawn at its true footprint). The
// deck pass sits above the base pass's texture overlay and draws, per
// lifted deck: a drop-shadow rect over the ground footprint, then the
// deck's rect shifted up by the stack's visual lift (see
// `StackGeometry` in world.ts). The ground tile "peeks" out of the
// bottom sliver the lift uncovers — shaded by the shadow, which is the
// under-the-span read. Texture sprites route to the matching pass's
// overlay container so draw order holds once art loads.
//
// Per-tile variant selection is deterministic: the renderer threads the
// battle's `masterSeed` into `pickTerrainVariantIndex(seed, x, y, n)`
// (see `assets/terrain/index.ts`). Same seed + same map → same per-
// tile picks across reloads, replays, and (eventually) network-shared
// battles.

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { BattleMap, TerrainType } from '@engine/index.ts';
import { pickTerrainVariantIndex } from '../assets/terrain/index.ts';
import { bridgeDeckVariantFor, BRIDGE_DECK_VARIANT_ORDER } from './bridge-variant.ts';
import type { StackGeometry } from './world.ts';
import {
  DECK_SHADOW_ALPHA,
  DECK_SHADOW_COLOR,
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
  // Texture overlay for the base pass. Sits above `graphics` so loaded
  // textures cover the colored rects. Cleared and re-populated by
  // `applyTerrainTextures`; before that runs (or for terrains without
  // manifest entries) it stays empty and the rects show.
  private readonly overlay: Container;
  // S97 deck pass: shadow + lifted-deck rects, above the base overlay
  // so a lifted deck covers the ground tile's texture, with the deck's
  // own textures on top.
  private readonly deckGraphics: Graphics;
  private readonly deckOverlay: Container;
  // Terrain types whose texture pool has applied. A lifted deck whose
  // terrain is textured SKIPS its solid fallback fill — the bridge kit
  // is deliberately narrower than the tile (transparent side margins),
  // and the fallback rect behind it would defeat the narrowing. Base-
  // pass tiles keep their fills regardless (their art is opaque).
  private readonly texturedTerrains: Set<TerrainType> = new Set();
  // Retained draw inputs so a late-arriving texture pool can repaint
  // the deck pass without the renderer re-supplying them.
  private lastMap: BattleMap | null = null;
  private lastGeo: StackGeometry | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'tiles';
    this.graphics = new Graphics();
    this.overlay = new Container();
    this.overlay.label = 'tile-overlay';
    this.deckGraphics = new Graphics();
    this.deckOverlay = new Container();
    this.deckOverlay.label = 'tile-deck-overlay';
    this.container.addChild(this.graphics);
    this.container.addChild(this.overlay);
    this.container.addChild(this.deckGraphics);
    this.container.addChild(this.deckOverlay);
  }

  draw(map: BattleMap, geo?: StackGeometry | null): void {
    this.lastMap = map;
    this.lastGeo = geo ?? null;
    const g = this.graphics;
    g.clear();

    // Group tiles by layer so higher layers draw on top of lower ones
    // (within each pass).
    const byLayer: ReadonlyMap<number, typeof map.tiles> = groupByLayer(map);
    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const layer of sortedLayers) {
      const tiles = byLayer.get(layer);
      if (tiles === undefined) continue;
      for (const tile of tiles) {
        if ((geo?.liftFor(tile) ?? 0) > 0) continue; // deck pass draws these
        const color = TERRAIN_COLORS[tile.terrain] ?? TERRAIN_FALLBACK_COLOR;
        const px = tile.x * TILE_SIZE + TILE_INSET / 2;
        const py = tile.y * TILE_SIZE + TILE_INSET / 2;
        const size = TILE_SIZE - TILE_INSET;
        g.rect(px, py, size, size);
        g.fill(color);
        g.stroke({ color: TILE_OUTLINE_COLOR, alpha: TILE_OUTLINE_ALPHA, width: 1 });
      }
    }

    this.redrawDeckPass();
  }

  // The deck pass: per lifted deck tile, the drop shadow on its true
  // footprint plus — only while its terrain's art hasn't applied — the
  // solid fallback fill at the lifted rect. Re-run when a texture pool
  // lands so the fallback fill disappears behind transparent-margin art.
  private redrawDeckPass(): void {
    const map = this.lastMap;
    const geo = this.lastGeo;
    const dg = this.deckGraphics;
    dg.clear();
    if (map === null || geo === null) return;
    // Decks draw FULL-BLEED (no TILE_INSET): a span's pieces are
    // authored edge-to-edge so consecutive tiles butt into one
    // continuous bridge — the inset gap made a span read as separate
    // floating planks. Full-bleed also matches the hit-test's deckRect
    // exactly.
    const sorted = [...map.tiles].sort((a, b) => a.layer - b.layer);
    for (const tile of sorted) {
      const lift = geo.liftFor(tile);
      if (lift <= 0) continue;
      const px = tile.x * TILE_SIZE;
      const py = tile.y * TILE_SIZE;
      dg.rect(px, py, TILE_SIZE, TILE_SIZE);
      dg.fill({ color: DECK_SHADOW_COLOR, alpha: DECK_SHADOW_ALPHA });
      if (!this.texturedTerrains.has(tile.terrain)) {
        const color = TERRAIN_COLORS[tile.terrain] ?? TERRAIN_FALLBACK_COLOR;
        dg.rect(px - lift, py - lift, TILE_SIZE, TILE_SIZE);
        dg.fill(color);
        dg.stroke({ color: TILE_OUTLINE_COLOR, alpha: TILE_OUTLINE_ALPHA, width: 1 });
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
    geo?: StackGeometry | null,
  ): void {
    if (textures.length === 0) return;
    // Remove any existing sprites of this terrain so re-applying after
    // a HMR or content swap doesn't pile up duplicates. Sprites are
    // labeled with their terrain type for cheap removal — from both
    // passes' overlays.
    for (const parent of [this.overlay, this.deckOverlay]) {
      for (const child of [...parent.children]) {
        if (child.label === `tile-${terrainType}`) {
          parent.removeChild(child);
          child.destroy();
        }
      }
    }
    const size = TILE_SIZE - TILE_INSET;
    const tint = TERRAIN_TINTS[terrainType] ?? TERRAIN_TINT_DEFAULT;
    for (const tile of map.tiles) {
      if (tile.terrain !== terrainType) continue;
      // S97: bridge decks wear ORIENTED art — the pool is the six-piece
      // kit in BRIDGE_DECK_VARIANT_ORDER, indexed by the map-derived
      // variant instead of the seeded pick.
      const idx =
        terrainType === 'bridge'
          ? Math.max(0, BRIDGE_DECK_VARIANT_ORDER.indexOf(bridgeDeckVariantFor(map, tile)))
          : pickTerrainVariantIndex(masterSeed, tile.x, tile.y, textures.length);
      const texture = textures[idx];
      if (texture === undefined) continue;
      const sprite = new Sprite(texture);
      sprite.label = `tile-${terrainType}`;
      const lift = geo?.liftFor(tile) ?? 0;
      // Bridge art draws full-bleed (see redrawDeckPass) so span pieces
      // butt seamlessly — lifted decks AND layer-0 bank ramps alike;
      // other terrain keeps the inset grid look. A ramp keeps its base-
      // pass fill beneath the art (its cell has no other tile below, so
      // the transparent margins would otherwise show the void).
      const fullBleed = lift > 0 || terrainType === 'bridge';
      const inset = fullBleed ? 0 : TILE_INSET / 2;
      let drawW = fullBleed ? TILE_SIZE : size;
      let drawH = drawW;
      let drawX = tile.x * TILE_SIZE + inset - lift;
      let drawY = tile.y * TILE_SIZE + inset - lift;
      // A layer-0 bank ramp stretches toward an adjacent LIFTED span
      // piece: the span's art shifts up-left with the visual lift while
      // the ramp sits at its true footprint, which would leave a
      // lift-sized diagonal jog at the joint. Extending the ramp's art
      // north/west by the neighbor's lift closes the seam (the deck's
      // drop shadow falls on the stretched strip, reading as the span
      // shading its own approach).
      if (terrainType === 'bridge' && lift === 0 && geo != null) {
        const northLift = geo.stackAt(tile.x, tile.y - 1)?.liftPx ?? 0;
        const westLift = geo.stackAt(tile.x - 1, tile.y)?.liftPx ?? 0;
        drawY -= northLift;
        drawH += northLift;
        drawX -= westLift;
        drawW += westLift;
      }
      sprite.x = drawX;
      sprite.y = drawY;
      // Fill the tile square on both axes. Scaling by a single dimension
      // (the old `max(w, h)`) only covered the tile when the texture was
      // square; a non-square variant (e.g. S70's 256×139 rock) left the
      // grey fallback rect showing through the uncovered strip. Per-axis
      // scale stretches any aspect ratio to fill exactly — terrain
      // textures tolerate the slight stretch better than a grey gap.
      sprite.scale.set(
        drawW / Math.max(texture.width, 1),
        drawH / Math.max(texture.height, 1),
      );
      if (tint !== TERRAIN_TINT_DEFAULT) sprite.tint = tint;
      // Lifted decks go to the deck pass so their art sits above the
      // ground tile's texture AND above the shadow rect.
      (lift > 0 ? this.deckOverlay : this.overlay).addChild(sprite);
    }
    // Art has (re)applied for this terrain: lifted decks of this type
    // drop their solid fallback fill so transparent margins show the
    // ground beneath rather than the fill.
    if (!this.texturedTerrains.has(terrainType)) {
      this.texturedTerrains.add(terrainType);
      this.redrawDeckPass();
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
