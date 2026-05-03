// World-to-screen helpers. Top-down orthographic projection: the engine
// works in tile coordinates `(x, y, layer)`; the renderer draws at
// pixel coordinates. Layer is currently a Z-order key (higher draws on
// top); the v1 demo map is single-layer so the layer math is a no-op
// pass-through.
//
// All functions are pure. The renderer's camera offset lives on the
// world Container's transform (set by `BattleRenderer.setCameraTarget`
// each tick), not in these helpers.

import type { Position } from '@engine/index.ts';
import { TILE_SIZE } from './constants.ts';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

// Center of a tile at integer (x, y). Used for unit sprite positioning.
export function tileCenter(x: number, y: number): ScreenPoint {
  return {
    x: x * TILE_SIZE + TILE_SIZE / 2,
    y: y * TILE_SIZE + TILE_SIZE / 2,
  };
}

// Center of a Position (sugar over tileCenter).
export function positionCenter(p: Position): ScreenPoint {
  return tileCenter(p.x, p.y);
}

// Linear interpolation between two screen points by t in [0,1]. The
// animator uses this to tween unit positions between the start and end
// of a path step.
export function lerp(a: ScreenPoint, b: ScreenPoint, t: number): ScreenPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}
