// Barrier layer — draws the Worldcraft Barrier objects (Session 55).
//
// A Barrier is a destructible wall the Terraformer spawns on a line of tiles
// (`Tile.barrier`, ADR-0088). It blocks movement and line of sight and takes
// damage from attacks. Pre-S55 it had no renderer presence at all — a spawned
// barrier was invisible, so the player couldn't see the wall they'd built.
//
// Each barrier tile draws as an ethereal force-wall: a translucent luminous-
// violet face, a pale upper-left bevel (the upper-left-lit convention shared
// with CliffEdgeLayer), and a bright violet glow outline — a conjured-energy
// read that contrasts with the blue/green/grey terrain. Layer placement:
// above terrain / cliff / elevation labels (the wall sits "on" the tile) but
// below the highlight + unit layers (UI overlays and sprites read on top).
//
// The renderer reads only the BattleMap — engine-blind. Repainted from
// `redrawStaticLayers()`, which the battle renderer now also runs on
// `system_barrier_change` / `system_barrier_damage` commits.

import { Container, Graphics } from 'pixi.js';
import type { BattleMap } from '@engine/index.ts';
import {
  BARRIER_BEVEL_COLOR,
  BARRIER_BEVEL_PX,
  BARRIER_FACE_ALPHA,
  BARRIER_FACE_COLOR,
  BARRIER_OUTLINE_COLOR,
  BARRIER_OUTLINE_WIDTH,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export class BarrierLayer {
  readonly container: Container;
  private readonly graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'barriers';
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  // Repaint every barrier on the map. Cheap — most maps hold zero barriers,
  // and a Terraformer's effect-cap bounds the live count to a handful.
  draw(map: BattleMap): void {
    const g = this.graphics;
    g.clear();
    const size = TILE_SIZE - TILE_INSET;
    for (const tile of map.tiles) {
      if (tile.barrier === undefined) continue;
      const px = tile.x * TILE_SIZE + TILE_INSET / 2;
      const py = tile.y * TILE_SIZE + TILE_INSET / 2;
      // Face.
      g.rect(px, py, size, size);
      g.fill({ color: BARRIER_FACE_COLOR, alpha: BARRIER_FACE_ALPHA });
      // Upper-left bevel (top + left strips) for a raised-block read.
      g.rect(px, py, size, BARRIER_BEVEL_PX);
      g.rect(px, py, BARRIER_BEVEL_PX, size);
      g.fill({ color: BARRIER_BEVEL_COLOR, alpha: BARRIER_FACE_ALPHA });
      // Outline.
      g.rect(px, py, size, size);
      g.stroke({ color: BARRIER_OUTLINE_COLOR, alpha: 1, width: BARRIER_OUTLINE_WIDTH });
    }
  }
}
