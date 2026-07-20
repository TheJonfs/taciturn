// World-to-screen helpers. Top-down orthographic projection: the engine
// works in tile coordinates `(x, y, layer)`; the renderer draws at
// pixel coordinates. Layer is a Z-order key (higher draws on top).
//
// S97 (bridge over/under UI): stacked cells — two occupiable tiles
// sharing an (x, y), per ADR-0155 — get a *visual deck lift*. The top
// tile of a stack draws shifted up-left (−x, −y) by a clamped,
// elevation-proportional pixel amount, leaving the bottom tile
// "peeking" out in the L-shaped strip (right + bottom edges) the lift
// uncovers. The lift is DIAGONAL, not straight-up, deliberately: the
// live content's bridge runs north–south, and a straight-up lift makes
// each deck's overhang land exactly on the sliver of the stacked cell
// north of it — interior under-cells of a vertical span would never
// peek. The diagonal keeps one sliver edge open on any straight run.
//
// `StackGeometry` is the single source of that lift: every layer
// (tiles, cliff edges, labels, highlights, units, hit-test) reads it
// here so the geometry can never disagree across layers. The visual
// lift is deliberately decoupled from the mechanical elevation
// (clamped) so a tall span can't push its art off-cell.
//
// All functions are pure. The renderer's camera offset lives on the
// world Container's transform (set by `BattleRenderer.setCameraTarget`
// each tick), not in these helpers.

import type { BattleMap, Position, Tile } from '@engine/index.ts';
import {
  DECK_LIFT_MAX_PX,
  DECK_LIFT_MIN_PX,
  DECK_LIFT_PX_PER_ELEVATION,
  TILE_SIZE,
} from './constants.ts';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

// Axis-aligned pixel rect (world coordinates).
export interface PixelRect {
  readonly px: number;
  readonly py: number;
  readonly w: number;
  readonly h: number;
}

// Intersection of two rects, or null when they don't overlap. Used by
// layers to clip a stacked ground cell's visible strips to their own
// inset footprints.
export function intersectRect(a: PixelRect, b: PixelRect): PixelRect | null {
  const px = Math.max(a.px, b.px);
  const py = Math.max(a.py, b.py);
  const right = Math.min(a.px + a.w, b.px + b.w);
  const bottom = Math.min(a.py + a.h, b.py + b.h);
  if (right <= px || bottom <= py) return null;
  return { px, py, w: right - px, h: bottom - py };
}

// Visual facts about one stacked cell (an (x, y) with ≥ 2 tiles).
export interface StackVisual {
  // Lowest layer at the cell — the "ground" the deck spans over.
  readonly groundLayer: number;
  // Highest layer at the cell — the lifted "deck".
  readonly deckLayer: number;
  // Pixels the deck's art shifts up-left (applied to both −x and −y)
  // from its true footprint. Also the thickness of the ground tile's
  // visible L-shaped sliver.
  readonly liftPx: number;
}

// Clamped, elevation-proportional visual lift. Exposed for unit tests.
// The clamp floor keeps the peeking sliver wide enough for the ground
// tile's elevation digit and a finger-sized tap region; the ceiling
// keeps a tall span's art from drifting too far over neighboring cells.
export function deckLiftPx(deckElevation: number, groundElevation: number): number {
  const delta = Math.max(1, deckElevation - groundElevation);
  return Math.max(
    DECK_LIFT_MIN_PX,
    Math.min(DECK_LIFT_MAX_PX, delta * DECK_LIFT_PX_PER_ELEVATION),
  );
}

// Per-map stack lookup, built once at mount and rebuilt whenever the
// map mutates (terrain change, bridge destruction). Cells with a single
// tile — the overwhelming majority — are absent from the index and pay
// nothing.
export class StackGeometry {
  private readonly stacks: Map<string, StackVisual> = new Map();
  // S97 bank ramps: single-layer cells tagged with the `bridge_ramp`
  // tile property. The cell's own (ground) art stays at its footprint,
  // but the bridge-kit ramp piece drawn OVER it — and everything that
  // should sit ON the ramp (unit sprites, highlights, labels) — rides
  // this lift, matched to the adjacent lifted span so the pieces butt.
  private readonly rampLifts: Map<string, number> = new Map();

  constructor(map: BattleMap) {
    const byCell = new Map<string, Tile[]>();
    for (const tile of map.tiles) {
      const key = `${tile.x},${tile.y}`;
      const list = byCell.get(key);
      if (list === undefined) byCell.set(key, [tile]);
      else list.push(tile);
    }
    for (const [key, tiles] of byCell) {
      if (tiles.length < 2) continue;
      tiles.sort((a, b) => a.layer - b.layer);
      const ground = tiles[0]!;
      const deck = tiles[tiles.length - 1]!;
      this.stacks.set(key, {
        groundLayer: ground.layer,
        deckLayer: deck.layer,
        liftPx: deckLiftPx(deck.elevation, ground.elevation),
      });
    }
    // Ramp pass (after stacks — a ramp matches its neighbor span's
    // lift). Ramp-tagged cells inside a stack are ignored: the stack's
    // own lift governs there.
    for (const tile of map.tiles) {
      if (!tile.properties.includes('bridge_ramp')) continue;
      const key = `${tile.x},${tile.y}`;
      if (this.stacks.has(key)) continue;
      let lift = 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const s = this.stacks.get(`${tile.x + dx},${tile.y + dy}`);
        if (s !== undefined) lift = Math.max(lift, s.liftPx);
      }
      this.rampLifts.set(key, lift > 0 ? lift : DECK_LIFT_MIN_PX);
    }
  }

  // Stack info for a cell, or undefined for the common single-tile case.
  stackAt(x: number, y: number): StackVisual | undefined {
    return this.stacks.get(`${x},${y}`);
  }

  // Visual up-left shift for the tile at `p`: the stack's lift when `p`
  // is a stacked cell's top (deck) tile; a ramp cell's lift on any
  // layer (the cell is single-tile); else 0. Middle layers of a
  // 3+-tile stack (no v1 content) draw unlifted like the ground.
  liftFor(p: Position): number {
    const key = `${p.x},${p.y}`;
    const s = this.stacks.get(key);
    if (s !== undefined) return p.layer === s.deckLayer ? s.liftPx : 0;
    return this.rampLifts.get(key) ?? 0;
  }

  // True when the cell is a `bridge_ramp`-tagged single-layer cell —
  // its OWN terrain art draws unlifted at the footprint while the
  // bridge-kit overlay (and everything standing on it) rides liftFor.
  isRampCell(x: number, y: number): boolean {
    return this.rampLifts.has(`${x},${y}`);
  }

  // True when `p` is the lifted deck tile of a stacked cell.
  isLiftedDeck(p: Position): boolean {
    return this.liftFor(p) > 0;
  }

  // True when `p` is the bottom tile of a stacked cell (drawn partially
  // covered, visible only in its sliver strips).
  isCoveredGround(p: Position): boolean {
    const s = this.stacks.get(`${p.x},${p.y}`);
    return s !== undefined && p.layer !== s.deckLayer;
  }

  // The full (un-inset) footprint rect of the lifted deck's art at a
  // stacked cell — the true footprint shifted up-left by the lift. Used
  // by the hit-test; undefined for non-stacked cells.
  deckRect(x: number, y: number): PixelRect | undefined {
    const s = this.stacks.get(`${x},${y}`);
    if (s === undefined) return undefined;
    return {
      px: x * TILE_SIZE - s.liftPx,
      py: y * TILE_SIZE - s.liftPx,
      w: TILE_SIZE,
      h: TILE_SIZE,
    };
  }

  // The parts of a stacked cell's ground tile that remain VISIBLE under
  // the lifted deck and its neighbors' decks, as un-inset world rects.
  // The diagonal lift uncovers an L (right strip + bottom strip); a
  // strip is dropped when the adjacent cell in that direction is itself
  // a lifted deck whose overhang covers it (interior cells of a
  // straight span keep exactly one strip). v1-sufficient: a cell whose
  // E AND S neighbors are both stacked (interior of a dense 2D deck —
  // no such content; dense multi-floor is the deferred layer-focus
  // mode) falls back to the bottom strip.
  //
  // Layers painting ground-cell visuals (highlights, cliff strips, the
  // elevation digit) confine them to these rects so they never paint on
  // top of deck art — this layer-independent region is what makes the
  // ground sliver honestly clickable: what you see is what the hit-test
  // resolves.
  visibleGroundRects(x: number, y: number): ReadonlyArray<PixelRect> {
    const s = this.stacks.get(`${x},${y}`);
    if (s === undefined) return [];
    const d = s.liftPx;
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const eastStacked = this.stacks.has(`${x + 1},${y}`);
    const southStacked = this.stacks.has(`${x},${y + 1}`);
    const rects: PixelRect[] = [];
    if (!eastStacked) {
      rects.push({ px: px + TILE_SIZE - d, py, w: d, h: TILE_SIZE });
    }
    if (!southStacked || eastStacked) {
      // Bottom strip; trimmed on the right when the right strip is also
      // present so the corner isn't double-painted by alpha overlays.
      const w = eastStacked ? TILE_SIZE : TILE_SIZE - d;
      rects.push({ px, py: py + TILE_SIZE - d, w, h: d });
    }
    return rects;
  }
}

// Center of a tile at integer (x, y). Used for unit sprite positioning.
export function tileCenter(x: number, y: number): ScreenPoint {
  return {
    x: x * TILE_SIZE + TILE_SIZE / 2,
    y: y * TILE_SIZE + TILE_SIZE / 2,
  };
}

// Center of a Position. When a StackGeometry is supplied, a position on
// a stacked cell's deck rides the visual lift so sprites sit on the
// lifted art (tweens between a lifted and an unlifted tile interpolate
// the lift smoothly because both endpoints route through here).
export function positionCenter(p: Position, geo?: StackGeometry | null): ScreenPoint {
  const c = tileCenter(p.x, p.y);
  const lift = geo?.liftFor(p) ?? 0;
  return lift > 0 ? { x: c.x - lift, y: c.y - lift } : c;
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
