// BattleRenderer — the renderer's top-level façade. Holds the PixiJS
// Application, owns the layered stage, mounts unit sprites, and drives
// the per-frame update from the Pixi ticker.
//
// Engine boundary: the renderer reads `GameState` once at mount to seed
// sprites and visual state, then consumes a stream of committed
// `Action`s (via `playActions`) to update visuals. It does not call the
// engine — that's the orchestrator's job in the App layer.
//
// Layer hierarchy (back to front):
//   stage
//   └── world (translated each frame for camera)
//       ├── tiles
//       └── units
// Overlays (win banner, HUD) live outside the renderer in React per the
// architecture overview ("UI depends on Engine and may depend on
// Renderer for the battle view component").

import { Container, type Application, type FederatedPointerEvent } from 'pixi.js';
import { tilesAt, unitAt, type Action, type GameState, type Position, type Unit, type UnitId } from '@engine/index.ts';
import { CAMERA_LERP, TILE_SIZE } from './constants.ts';
import { TileLayer } from './tile-layer.ts';
import { UnitSprite } from './unit-layer.ts';
import { HighlightLayer, type HighlightKind } from './highlight-layer.ts';
import { Animator } from './animator.ts';
import { positionCenter, type ScreenPoint } from './world.ts';

export type TileClickHandler = (pos: Position, unit: Unit | null) => void;

export class BattleRenderer {
  readonly app: Application;
  private readonly world: Container;
  private readonly tileLayer: TileLayer;
  private readonly highlightLayer: HighlightLayer;
  private readonly unitLayer: Container;
  private readonly sprites: Map<UnitId, UnitSprite> = new Map();
  private readonly animator: Animator = new Animator();
  private cameraPos: ScreenPoint = { x: 0, y: 0 };
  private cameraTarget: ScreenPoint = { x: 0, y: 0 };
  private lastState: GameState | null = null;
  private tileClickHandler: TileClickHandler | null = null;

  constructor(app: Application) {
    this.app = app;
    this.world = new Container();
    this.world.label = 'world';
    this.app.stage.addChild(this.world);

    this.tileLayer = new TileLayer();
    this.highlightLayer = new HighlightLayer();
    this.unitLayer = new Container();
    this.unitLayer.label = 'units';
    this.world.addChild(
      this.tileLayer.container,
      this.highlightLayer.container,
      this.unitLayer,
    );

    // Pointer events on the stage. Stage covers the full canvas, so
    // clicks outside the map area still arrive — the hit-test below
    // filters by map bounds.
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointertap', (e) => this.onPointerTap(e));
  }

  // Build initial sprites and tile geometry from the starting state.
  // Call once after construction; subsequent frames use playActions().
  mount(state: GameState): void {
    this.lastState = state;
    this.tileLayer.draw(state.map);

    // Center camera on the map midpoint to start, then it'll lerp toward
    // the active unit on the first turn_start.
    const initialFocus = mapCenter(state);
    this.cameraPos = initialFocus;
    this.cameraTarget = initialFocus;

    for (const unit of state.units.values()) {
      const sprite = new UnitSprite(unit);
      this.sprites.set(unit.id, sprite);
      this.unitLayer.addChild(sprite.container);
      this.animator.initSnapshot(unit.id, {
        position: positionCenter(unit.position),
        facing: unit.facing,
        hp: unit.vitals.hp,
        maxHp: unit.baseStats.maxHpBase,
        ko: unit.vitals.hp <= 0,
        flash: 0,
      });
    }

    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
    // Render once so the canvas isn't blank before the ticker fires.
    this.applyVisualState();
    this.applyCamera(true);
  }

  // Append committed actions for the animator to play out. Called by
  // the orchestrator wrapper whenever it commits a step.
  playActions(actions: ReadonlyArray<Action>, newState: GameState): void {
    this.lastState = newState;
    this.animator.enqueue(actions);
  }

  // True when the animator has nothing left to play. The orchestrator
  // wrapper polls this between steps.
  isIdle(): boolean {
    return this.animator.isIdle();
  }

  // Set (or clear, by passing `null`) a single handler that fires on a
  // tile-click. Receives the (x, y, layer) Position and the unit at
  // that tile if any. Clicks outside the map are silently dropped.
  setOnTileClick(handler: TileClickHandler | null): void {
    this.tileClickHandler = handler;
  }

  // Replace the highlight overlay set. UI uses this to communicate
  // "these are your legal moves" / "these are valid targets" / etc.
  // Pass `kind: 'none'` or an empty array to clear.
  setHighlights(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    this.highlightLayer.set(positions, kind);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: false });
  }

  // ---- pointer events ----

  private onPointerTap(e: FederatedPointerEvent): void {
    if (this.tileClickHandler === null || this.lastState === null) return;
    const local = this.world.toLocal(e.global);
    const tileX = Math.floor(local.x / TILE_SIZE);
    const tileY = Math.floor(local.y / TILE_SIZE);
    const map = this.lastState.map;
    if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return;
    const tiles = tilesAt(map, tileX, tileY);
    if (tiles.length === 0) return;
    // Topmost layer wins for hit-testing — matches the visual stacking
    // in TileLayer.draw.
    let top = tiles[0]!;
    for (let i = 1; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (t.layer > top.layer) top = t;
    }
    const pos: Position = { x: tileX, y: tileY, layer: top.layer };
    const occupant = unitAt(this.lastState, tileX, tileY, top.layer) ?? null;
    this.tileClickHandler(pos, occupant);
  }

  // ---- per-frame ----

  private tick(dtMs: number): void {
    this.animator.tick(dtMs);
    this.updateCameraTarget();
    this.applyVisualState();
    this.applyCamera(false);
  }

  private updateCameraTarget(): void {
    if (this.lastState === null) return;
    const activeId = this.animator.getActiveUnit();
    if (activeId !== null) {
      const snap = this.animator.getSnapshot(activeId);
      if (snap !== undefined) {
        this.cameraTarget = snap.position;
        return;
      }
    }
    // Between turns: drift back to map center so nothing pops off-screen.
    this.cameraTarget = mapCenter(this.lastState);
  }

  private applyCamera(snap: boolean): void {
    const cx = this.app.renderer.width / 2;
    const cy = this.app.renderer.height / 2;
    if (snap) {
      this.cameraPos = this.cameraTarget;
    } else {
      this.cameraPos = {
        x: this.cameraPos.x + (this.cameraTarget.x - this.cameraPos.x) * CAMERA_LERP,
        y: this.cameraPos.y + (this.cameraTarget.y - this.cameraPos.y) * CAMERA_LERP,
      };
    }
    this.world.position.set(cx - this.cameraPos.x, cy - this.cameraPos.y);
  }

  private applyVisualState(): void {
    const activeId = this.animator.getActiveUnit();
    for (const [unitId, sprite] of this.sprites) {
      const snap = this.animator.getSnapshot(unitId);
      if (snap === undefined) continue;
      sprite.setVisualState({
        position: snap.position,
        facing: snap.facing,
        hp: snap.hp,
        maxHp: snap.maxHp,
        ko: snap.ko,
        flash: snap.flash,
        active: activeId === unitId,
      });
    }
  }
}

function mapCenter(state: GameState): ScreenPoint {
  const cx = (state.map.width * TILE_SIZE) / 2;
  const cy = (state.map.height * TILE_SIZE) / 2;
  return { x: cx, y: cy };
}
