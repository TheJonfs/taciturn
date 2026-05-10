// CameraController — owns camera position and zoom for the battle
// canvas. Maps a world-space focal point and a zoom factor onto the
// world container's transform.
//
// Coordinate systems:
//   - World space: pixel coordinates of the map plane. (0,0) is the
//     top-left of tile (0,0). Map size in world pixels is
//     `mapWidth * tileSize × mapHeight * tileSize`.
//   - Screen space: pixel coordinates of the canvas viewport. (0,0) is
//     the top-left of the canvas.
//
// The camera tracks a `position` in world space — the point that ends
// up under the screen-space center — plus a `zoom` factor.
//
// State machine (per `docs/twentyOneDesign/battle-ui-architecture.md`,
// "Camera State"):
//
//   AUTO_FOLLOWING   ←── engageAutoFollow()
//        │                       │
//        ▼                       │
//   USER_DRIVEN ── pan/zoom ─────┘
//
// In AUTO_FOLLOWING the camera lerps toward the auto-target each tick.
// User input (WASD pan, wheel zoom) flips the mode to USER_DRIVEN
// and the camera stays put until the next external `engageAutoFollow()`
// call (BattleRenderer triggers this on turn-start when the active
// unit changes).
//
// Pure logic where it matters (math is unit-tested via getPosition /
// getZoom); the only Pixi side-effect is `apply(world)` which writes
// the world container's transform.

import type { Container } from 'pixi.js';
import { CAMERA_LERP } from './constants.ts';
import type { ScreenPoint } from './world.ts';

export type CameraMode = 'auto-follow' | 'user-driven';

export interface PanInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export interface CameraOptions {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly tileSize: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  // Maximum zoom-in factor. Default = 3 (a single tile is ~3× its
  // unzoomed size). Min zoom is computed from map / screen geometry so
  // the whole map fits at the lowest zoom level.
  readonly maxZoom?: number;
  // Pan speed expressed in tiles-per-second at zoom 1. Effective speed
  // scales as `tilesPerSec * tileSize / zoom`, so the *world* travel is
  // faster when zoomed out (the brief's "navigating across the map at
  // overview is reasonable").
  readonly panTilesPerSec?: number;
  // Padding factor for fit-map (1.0 = exactly fit, 0.9 = leave 10%
  // breathing room on the constrained axis).
  readonly fitPadding?: number;
}

const NO_PAN: PanInput = { left: false, right: false, up: false, down: false };

export class CameraController {
  private mapWidth: number;
  private mapHeight: number;
  private tileSize: number;
  private screenWidth: number;
  private screenHeight: number;
  private maxZoom: number;
  private panTilesPerSec: number;
  private fitPadding: number;

  private position: ScreenPoint = { x: 0, y: 0 };
  private zoom = 1;
  private mode: CameraMode = 'auto-follow';
  private autoTarget: ScreenPoint | null = null;
  private panInput: PanInput = NO_PAN;

  constructor(opts: CameraOptions) {
    this.mapWidth = Math.max(1, opts.mapWidth);
    this.mapHeight = Math.max(1, opts.mapHeight);
    this.tileSize = opts.tileSize;
    this.screenWidth = Math.max(1, opts.screenWidth);
    this.screenHeight = Math.max(1, opts.screenHeight);
    this.maxZoom = opts.maxZoom ?? 3;
    this.panTilesPerSec = opts.panTilesPerSec ?? 8;
    this.fitPadding = opts.fitPadding ?? 0.92;
    this.fitMap();
  }

  // Map dimensions can change between battles. Recompute fit-zoom and
  // re-clamp position. Caller decides whether to also `fitMap()` to
  // reset the framing.
  setMapSize(width: number, height: number): void {
    this.mapWidth = Math.max(1, width);
    this.mapHeight = Math.max(1, height);
    this.clampZoom();
    this.clampPosition();
  }

  // Canvas size changes when the host container resizes (the brief's
  // future feature; covered now so the renderer can call this without
  // knowing the camera's internals).
  setScreenSize(width: number, height: number): void {
    this.screenWidth = Math.max(1, width);
    this.screenHeight = Math.max(1, height);
    this.clampZoom();
    this.clampPosition();
  }

  // Center the map in the viewport at the lowest zoom that fits both
  // dimensions. Used at battle start and after a viewport resize.
  fitMap(): void {
    this.zoom = this.computeFitZoom();
    this.position = {
      x: (this.mapWidth * this.tileSize) / 2,
      y: (this.mapHeight * this.tileSize) / 2,
    };
    this.mode = 'auto-follow';
  }

  // Switch back to AUTO_FOLLOWING. Called by the renderer when the
  // active unit changes (turn-start). Doesn't move the camera by
  // itself; the next `update()` lerp toward `autoTarget` does.
  engageAutoFollow(): void {
    this.mode = 'auto-follow';
  }

  // Update the auto-follow target. Renderer calls this every tick with
  // the current active unit's world-space position so the camera
  // tracks mid-turn movement when in AUTO_FOLLOWING. Has no immediate
  // effect when in USER_DRIVEN.
  setAutoFollowTarget(target: ScreenPoint | null): void {
    this.autoTarget = target;
  }

  // Keyboard input. The renderer reads key state and pushes it here
  // each tick. Active pan transitions the camera to USER_DRIVEN.
  setPanInput(input: PanInput): void {
    this.panInput = input;
  }

  // Wheel-zoom input. `deltaFactor` > 1 zooms in, < 1 zooms out.
  // `focalPointScreen` is the screen-space pixel the user is zooming
  // around (cursor position for wheel; screen center for +/- buttons).
  // The world point under the focal stays put; cameraPos shifts to
  // make that geometry hold. Transitions to USER_DRIVEN.
  applyZoom(deltaFactor: number, focalPointScreen: ScreenPoint): void {
    const oldZoom = this.zoom;
    const minZoom = this.computeFitZoom();
    const newZoom = clamp(oldZoom * deltaFactor, minZoom, this.maxZoom);
    if (newZoom === oldZoom) return;

    const cx = this.screenWidth / 2;
    const cy = this.screenHeight / 2;
    // World point currently under the focal:
    const worldUnderFocal = {
      x: this.position.x + (focalPointScreen.x - cx) / oldZoom,
      y: this.position.y + (focalPointScreen.y - cy) / oldZoom,
    };
    // Solve for the new camera position so the same world point lands
    // under the focal at the new zoom:
    this.zoom = newZoom;
    this.position = {
      x: worldUnderFocal.x - (focalPointScreen.x - cx) / newZoom,
      y: worldUnderFocal.y - (focalPointScreen.y - cy) / newZoom,
    };
    this.clampPosition();
    this.mode = 'user-driven';
  }

  // Per-frame advancement.
  update(dtMs: number): void {
    const dx =
      (this.panInput.right ? 1 : 0) - (this.panInput.left ? 1 : 0);
    const dy =
      (this.panInput.down ? 1 : 0) - (this.panInput.up ? 1 : 0);

    if (dx !== 0 || dy !== 0) {
      const speedWorldPxPerSec =
        (this.panTilesPerSec * this.tileSize) / this.zoom;
      const dist = speedWorldPxPerSec * (dtMs / 1000);
      const len = Math.hypot(dx, dy);
      this.position = {
        x: this.position.x + (dx / len) * dist,
        y: this.position.y + (dy / len) * dist,
      };
      this.clampPosition();
      this.mode = 'user-driven';
    }

    if (this.mode === 'auto-follow' && this.autoTarget !== null) {
      this.position = {
        x: this.position.x + (this.autoTarget.x - this.position.x) * CAMERA_LERP,
        y: this.position.y + (this.autoTarget.y - this.position.y) * CAMERA_LERP,
      };
      this.clampPosition();
    }
  }

  // Pixi side-effect: write the world's transform.
  apply(world: Container): void {
    world.scale.set(this.zoom, this.zoom);
    const cx = this.screenWidth / 2;
    const cy = this.screenHeight / 2;
    world.position.set(
      cx - this.position.x * this.zoom,
      cy - this.position.y * this.zoom,
    );
  }

  // ---- read-only accessors (tests) ----

  getPosition(): ScreenPoint {
    return this.position;
  }

  getZoom(): number {
    return this.zoom;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  // ---- internals ----

  private computeFitZoom(): number {
    const mapPxW = this.mapWidth * this.tileSize;
    const mapPxH = this.mapHeight * this.tileSize;
    const fit = Math.min(
      this.screenWidth / mapPxW,
      this.screenHeight / mapPxH,
    );
    return fit * this.fitPadding;
  }

  private clampZoom(): void {
    const minZoom = this.computeFitZoom();
    if (this.zoom < minZoom) this.zoom = minZoom;
    if (this.zoom > this.maxZoom) this.zoom = this.maxZoom;
  }

  private clampPosition(): void {
    // Keep the camera focal point inside the map. v1 doesn't model the
    // overshoot tolerance the design doc allows ("~2 tiles of overshoot
    // margin"); strict clamping is good enough for the first preview
    // and avoids a second knob to tune.
    const mapPxW = this.mapWidth * this.tileSize;
    const mapPxH = this.mapHeight * this.tileSize;
    this.position = {
      x: clamp(this.position.x, 0, mapPxW),
      y: clamp(this.position.y, 0, mapPxH),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
