// Deployment-facing layer — draws the four cardinal-direction arrows
// around the tile of the unit being placed during the deployment phase
// (Session 35 / Phase E). FFT-classic facing picker: click an arrow to
// commit that facing.
//
// Dynamic, unlike the zone layer: `draw(tile)` is called when the
// deployment flow enters `unit_selected` and `draw(null)` (or `clear`)
// on transition out. The arrows are renderer-drawn (not DOM) so they
// align to the tile grid and ride the camera transform.
//
// The arrows are interactive Pixi `Graphics`: a `pointertap` on an
// arrow calls the registered `onPick` handler and stops propagation so
// the stage-level tile-click handler doesn't also fire. Keyboard
// parity (arrow keys) is handled by `deployment-facing-picker.tsx` in
// the UI layer — this layer is the mouse surface + the visual.
//
// Layer placement: above the unit layer — the arrows draw over the
// just-placed unit ghost they surround.

import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import type { Direction, Position } from '@engine/index.ts';
import {
  DEPLOYMENT_FACING_ARROW_ALPHA,
  DEPLOYMENT_FACING_ARROW_COLOR,
  DEPLOYMENT_FACING_ARROW_OUTLINE,
  DEPLOYMENT_FACING_ARROW_OUTLINE_WIDTH,
  TILE_SIZE,
} from './constants.ts';
import { positionCenter } from './world.ts';

// Cardinal order — also the order the arrows are added as children, so
// a test can assert four arrows in N/E/S/W order.
export const DEPLOYMENT_FACING_DIRECTIONS: ReadonlyArray<Direction> = [
  'N',
  'E',
  'S',
  'W',
];

// Pixel offset of an arrow's center from the tile center — one full
// tile-step out along the cardinal. Pure; exposed for unit tests.
export function facingArrowOffset(direction: Direction): {
  readonly x: number;
  readonly y: number;
} {
  switch (direction) {
    case 'N':
      return { x: 0, y: -TILE_SIZE };
    case 'S':
      return { x: 0, y: TILE_SIZE };
    case 'E':
      return { x: TILE_SIZE, y: 0 };
    case 'W':
      return { x: -TILE_SIZE, y: 0 };
  }
}

// Absolute world-pixel center of an arrow for a tile + direction.
// Pure; exposed for unit tests.
export function facingArrowCenter(
  tile: Position,
  direction: Direction,
): { readonly x: number; readonly y: number } {
  const center = positionCenter(tile);
  const offset = facingArrowOffset(direction);
  return { x: center.x + offset.x, y: center.y + offset.y };
}

// Rotation (degrees) applied to a base upward-pointing triangle so it
// points in `direction`. Pure; exposed for unit tests.
export function facingArrowAngle(direction: Direction): number {
  switch (direction) {
    case 'N':
      return 0;
    case 'E':
      return 90;
    case 'S':
      return 180;
    case 'W':
      return 270;
  }
}

export type FacingPickHandler = (direction: Direction) => void;

export class DeploymentFacingLayer {
  readonly container: Container;
  private onPick: FacingPickHandler | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'deployment-facing';
  }

  // Register (or clear, with `null`) the handler invoked when an arrow
  // is clicked.
  setOnPick(handler: FacingPickHandler | null): void {
    this.onPick = handler;
  }

  // Draw the four cardinal arrows around `tile`. Pass `null` to clear.
  // Rebuilds from scratch each call (the picker is only ever shown for
  // one tile at a time).
  draw(tile: Position | null): void {
    for (const child of [...this.container.children]) {
      this.container.removeChild(child);
      child.destroy();
    }
    if (tile === null) return;
    for (const direction of DEPLOYMENT_FACING_DIRECTIONS) {
      const arrow = buildArrow();
      const center = facingArrowCenter(tile, direction);
      arrow.x = center.x;
      arrow.y = center.y;
      arrow.angle = facingArrowAngle(direction);
      arrow.eventMode = 'static';
      arrow.cursor = 'pointer';
      arrow.on('pointertap', (e: FederatedPointerEvent) => {
        // Stop the stage-level tile-click handler from also firing.
        e.stopPropagation();
        this.onPick?.(direction);
      });
      this.container.addChild(arrow);
    }
  }

  clear(): void {
    this.draw(null);
  }
}

// An upward-pointing triangle centered at (0, 0). Callers rotate it via
// `angle` to point in the desired cardinal.
function buildArrow(): Graphics {
  const g = new Graphics();
  const r = TILE_SIZE * 0.26;
  g.poly([0, -r, r * 0.82, r * 0.7, -r * 0.82, r * 0.7]);
  g.fill({ color: DEPLOYMENT_FACING_ARROW_COLOR, alpha: DEPLOYMENT_FACING_ARROW_ALPHA });
  g.stroke({
    color: DEPLOYMENT_FACING_ARROW_OUTLINE,
    width: DEPLOYMENT_FACING_ARROW_OUTLINE_WIDTH,
    join: 'round',
  });
  return g;
}
