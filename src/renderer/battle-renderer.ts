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
import { tilesAt, unitAt, type Action, type Catalog, type GameState, type Position, type Unit, type UnitId } from '@engine/index.ts';
import { TILE_SIZE } from './constants.ts';
import { TileLayer } from './tile-layer.ts';
import { statusBadgeFromInstance, UnitSprite, type StatusBadge } from './unit-layer.ts';
import { HighlightLayer, type HighlightKind } from './highlight-layer.ts';
import { Animator } from './animator.ts';
import { CameraController, type PanInput } from './camera-controller.ts';
import { positionCenter, type ScreenPoint } from './world.ts';

export type TileClickHandler = (pos: Position, unit: Unit | null) => void;
export type TileHoverHandler = (pos: Position | null, unit: Unit | null) => void;

export class BattleRenderer {
  readonly app: Application;
  private readonly world: Container;
  private readonly tileLayer: TileLayer;
  private readonly highlightLayer: HighlightLayer;
  private readonly unitLayer: Container;
  private readonly sprites: Map<UnitId, UnitSprite> = new Map();
  private readonly animator: Animator = new Animator();
  private readonly maxMp: Map<UnitId, number> = new Map();
  private camera: CameraController | null = null;
  private catalog: Catalog | null = null;
  private lastActiveUnit: UnitId | null = null;
  private lastState: GameState | null = null;
  private tileClickHandler: TileClickHandler | null = null;
  private tileHoverHandler: TileHoverHandler | null = null;
  private lastHoverKey: string | null = null;
  private paused: boolean = false;

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
    this.app.stage.on('pointermove', (e) => this.onPointerMove(e));
    this.app.stage.on('pointerleave', () => this.onPointerLeave());
  }

  // Build initial sprites and tile geometry from the starting state.
  // Call once after construction; subsequent frames use playActions().
  // The catalog is captured for status-tag lookups (badge polarity);
  // visualization-only consumer of catalog data — the renderer never
  // dispatches actions or reads ability rules.
  mount(state: GameState, catalog: Catalog): void {
    this.lastState = state;
    this.catalog = catalog;
    this.tileLayer.draw(state.map);

    this.camera = new CameraController({
      mapWidth: state.map.width,
      mapHeight: state.map.height,
      tileSize: TILE_SIZE,
      screenWidth: this.app.renderer.width,
      screenHeight: this.app.renderer.height,
    });

    for (const unit of state.units.values()) {
      // Capture the unit's starting MP as their effective max for the
      // duration of the battle. v1 has no maxMp stat (Cluster 4 /
      // Session 28); MP-restoration sources are rare in current
      // content, so the starting value is a workable cap. If a future
      // session adds MP gain past this, surface a refresh hook here.
      this.maxMp.set(unit.id, unit.vitals.mp);

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
    this.camera.apply(this.world);
  }

  // Camera-input surface — BattleView wires keyboard/wheel handlers to
  // these passthroughs so the renderer is the only owner of the camera
  // controller.
  setPanInput(input: PanInput): void {
    this.camera?.setPanInput(input);
  }

  applyZoomAt(deltaFactor: number, focalPointScreen: ScreenPoint): void {
    this.camera?.applyZoom(deltaFactor, focalPointScreen);
  }

  setScreenSize(width: number, height: number): void {
    this.camera?.setScreenSize(width, height);
  }

  fitMap(): void {
    this.camera?.fitMap();
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

  // Set (or clear) the hover handler. Fires whenever the pointer moves
  // to a different tile, with `null` when the pointer leaves the map.
  // Used by the UI's targeting layer for AoE preview-on-hover.
  setOnTileHover(handler: TileHoverHandler | null): void {
    this.tileHoverHandler = handler;
    if (handler === null) this.lastHoverKey = null;
  }

  // Replace the base highlight set (legal targets / reachable moves).
  // Pass `kind: 'none'` or an empty array to clear.
  setHighlights(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    this.highlightLayer.setBase(positions, kind);
  }

  // Replace the overlay highlight set (AoE preview, hovered target).
  // Drawn on top of the base channel at a brighter alpha. Pass
  // `kind: 'none'` or an empty array to clear.
  setHighlightOverlay(positions: ReadonlyArray<Position>, kind: HighlightKind): void {
    this.highlightLayer.setOverlay(positions, kind);
  }

  // Halt the animator while paused. The Pixi ticker keeps running (so
  // the renderer stays responsive to camera input and the React tree
  // can paint over it), but action playback freezes until resume.
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: false });
  }

  // ---- pointer events ----

  private onPointerTap(e: FederatedPointerEvent): void {
    if (this.tileClickHandler === null || this.lastState === null) return;
    const hit = this.hitTest(e);
    if (hit === null) return;
    this.tileClickHandler(hit.pos, hit.occupant);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.tileHoverHandler === null || this.lastState === null) return;
    const hit = this.hitTest(e);
    if (hit === null) {
      if (this.lastHoverKey !== null) {
        this.lastHoverKey = null;
        this.tileHoverHandler(null, null);
      }
      return;
    }
    const key = `${hit.pos.x},${hit.pos.y},${hit.pos.layer}`;
    if (key === this.lastHoverKey) return; // dedupe same-tile moves
    this.lastHoverKey = key;
    this.tileHoverHandler(hit.pos, hit.occupant);
  }

  private onPointerLeave(): void {
    if (this.tileHoverHandler === null) return;
    if (this.lastHoverKey === null) return;
    this.lastHoverKey = null;
    this.tileHoverHandler(null, null);
  }

  private hitTest(e: FederatedPointerEvent): { pos: Position; occupant: Unit | null } | null {
    if (this.lastState === null) return null;
    const local = this.world.toLocal(e.global);
    const tileX = Math.floor(local.x / TILE_SIZE);
    const tileY = Math.floor(local.y / TILE_SIZE);
    const map = this.lastState.map;
    if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return null;
    const tiles = tilesAt(map, tileX, tileY);
    if (tiles.length === 0) return null;
    // Topmost layer wins for hit-testing — matches the visual stacking
    // in TileLayer.draw.
    let top = tiles[0]!;
    for (let i = 1; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (t.layer > top.layer) top = t;
    }
    const pos: Position = { x: tileX, y: tileY, layer: top.layer };
    const occupant = unitAt(this.lastState, tileX, tileY, top.layer) ?? null;
    return { pos, occupant };
  }

  // ---- per-frame ----

  private tick(dtMs: number): void {
    if (!this.paused) {
      this.animator.tick(dtMs);
      this.updateCameraTarget();
    }
    // Camera input keeps working while paused — the user can still pan
    // and zoom around to inspect the frozen state.
    this.camera?.update(dtMs);
    this.applyVisualState();
    this.camera?.apply(this.world);
  }

  private updateCameraTarget(): void {
    if (this.camera === null) return;
    const activeId = this.animator.getActiveUnit();

    // Active-unit transition is the camera state machine's turn-start
    // re-engagement event. If the user panned during the previous
    // turn, the camera reverts to AUTO_FOLLOWING here so it pans to
    // the new active unit.
    if (activeId !== this.lastActiveUnit) {
      if (activeId !== null) {
        this.camera.engageAutoFollow();
      }
      this.lastActiveUnit = activeId;
    }

    if (activeId !== null) {
      const snap = this.animator.getSnapshot(activeId);
      if (snap !== undefined) {
        this.camera.setAutoFollowTarget(snap.position);
        return;
      }
    }
    // No active unit (between turns / pre-first-turn). Clear the
    // target; the camera holds its current position.
    this.camera.setAutoFollowTarget(null);
  }

  private applyVisualState(): void {
    const activeId = this.animator.getActiveUnit();
    for (const [unitId, sprite] of this.sprites) {
      const snap = this.animator.getSnapshot(unitId);
      if (snap === undefined) continue;
      // MP and statuses snap to current engine state (no animator-side
      // tween tracking yet). The state's-eye view: mp/statuses are
      // "instant" facts about the unit; HP keeps the existing
      // tween-on-flash behavior so damage reads feel like impact.
      const unit = this.lastState?.units.get(unitId);
      const mp = unit?.vitals.mp ?? 0;
      const maxMp = this.maxMp.get(unitId) ?? Math.max(mp, 1);
      const statuses = unit !== undefined ? this.computeStatusBadges(unit) : [];
      sprite.setVisualState({
        position: snap.position,
        facing: snap.facing,
        hp: snap.hp,
        maxHp: snap.maxHp,
        mp,
        maxMp,
        ko: snap.ko,
        flash: snap.flash,
        active: activeId === unitId,
        statuses,
      });
    }
  }

  private computeStatusBadges(unit: Unit): ReadonlyArray<StatusBadge> {
    if (this.catalog === null || unit.statuses.length === 0) return [];
    const out: StatusBadge[] = [];
    for (const status of unit.statuses) {
      try {
        const type = this.catalog.getStatusType(status.typeId);
        out.push(statusBadgeFromInstance(status, type.tags));
      } catch {
        // Unknown status type id (shouldn't happen with a valid
        // catalog, but the renderer is graceful — drop the badge
        // rather than crash a frame).
        out.push(statusBadgeFromInstance(status, []));
      }
    }
    return out;
  }
}
