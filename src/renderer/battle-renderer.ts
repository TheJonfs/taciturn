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

import { Assets, Container, type Application, type FederatedPointerEvent, type Texture } from 'pixi.js';
import {
  runModifyStatQuery,
  tilesAt,
  unitAt,
  type Action,
  type Catalog,
  type ClassId,
  type GameState,
  type Position,
  type TeamId,
  type TerrainType,
  type Unit,
  type UnitId,
} from '@engine/index.ts';
import { TILE_SIZE } from './constants.ts';
import { TileLayer } from './tile-layer.ts';
import { CliffEdgeLayer } from './cliff-edge-layer.ts';
import { ElevationLabelLayer } from './elevation-label-layer.ts';
import { statusBadgeFromInstance, UnitSprite, type StatusBadge } from './unit-layer.ts';
import { HighlightLayer, type HighlightKind } from './highlight-layer.ts';
import { Animator } from './animator.ts';
import { CameraController, type PanInput } from './camera-controller.ts';
import { positionCenter, type ScreenPoint } from './world.ts';
import { PORTRAIT_URLS } from '../assets/portraits/index.ts';
import { terrainTexturePoolFor } from '../assets/terrain/index.ts';

export type TileClickHandler = (pos: Position, unit: Unit | null) => void;
export type TileHoverHandler = (pos: Position | null, unit: Unit | null) => void;

export class BattleRenderer {
  readonly app: Application;
  private readonly world: Container;
  private readonly tileLayer: TileLayer;
  // Per ADR-0072 (Session 32): cliff-edge overlay between tiles and
  // highlights. Renders darkened edge strips on any tile whose cardinal
  // neighbor sits at lower elevation. Static for the map's lifetime;
  // a future elevation-mutation ability would re-call `draw`.
  private readonly cliffEdgeLayer: CliffEdgeLayer;
  // Per Session 33's in-session decision (revised mid-session): a
  // numeric per-tile elevation label replaces the earlier pip-stack
  // design. Cliff edges show *that* two adjacent tiles differ in
  // elevation; the labels show *the exact elevation*. Drawn above
  // cliff edges and below highlights.
  private readonly elevationLabelLayer: ElevationLabelLayer;
  private readonly highlightLayer: HighlightLayer;
  private readonly unitLayer: Container;
  private readonly sprites: Map<UnitId, UnitSprite> = new Map();
  private readonly animator: Animator = new Animator();
  private camera: CameraController | null = null;
  private catalog: Catalog | null = null;
  private lastActiveUnit: UnitId | null = null;
  private lastState: GameState | null = null;
  private tileClickHandler: TileClickHandler | null = null;
  private tileHoverHandler: TileHoverHandler | null = null;
  private lastHoverKey: string | null = null;
  private paused: boolean = false;
  private counterpartUnits: ReadonlySet<UnitId> = new Set();
  // Tracks the last set of tiles painted by the animator's
  // charged-resolve pre-highlight (session 26.5 / item #5). Used to
  // avoid setHighlightOverlay churn at 60fps — we only repaint on
  // transitions (anim starts → tiles list; anim ends → empty).
  private lastTileHighlightKey: string = '';
  // Texture cache for class portraits, populated asynchronously after
  // mount via `loadPortraitAssets`. Sprites created for units added
  // after a texture is cached (mid-battle summons, future work) read
  // from here to get the same texture.
  private readonly portraitTextures: Map<ClassId, Texture> = new Map();
  // Per-terrain-type texture pool cache. Populated asynchronously by
  // `loadTerrainAssets` per ADR-0054. When a type's pool resolves,
  // `TileLayer.applyTerrainTextures` overlays sprites on the relevant
  // tiles using `pickTerrainVariantIndex(masterSeed, x, y, n)` for
  // deterministic per-tile variant selection.
  private readonly terrainTextures: Map<TerrainType, ReadonlyArray<Texture>> = new Map();

  constructor(app: Application) {
    this.app = app;
    this.world = new Container();
    this.world.label = 'world';
    this.app.stage.addChild(this.world);

    this.tileLayer = new TileLayer();
    this.cliffEdgeLayer = new CliffEdgeLayer();
    this.elevationLabelLayer = new ElevationLabelLayer();
    this.highlightLayer = new HighlightLayer();
    this.unitLayer = new Container();
    this.unitLayer.label = 'units';
    this.world.addChild(
      this.tileLayer.container,
      this.cliffEdgeLayer.container,
      this.elevationLabelLayer.container,
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
    this.cliffEdgeLayer.draw(state.map);
    this.elevationLabelLayer.draw(state.map);

    this.camera = new CameraController({
      mapWidth: state.map.width,
      mapHeight: state.map.height,
      tileSize: TILE_SIZE,
      screenWidth: this.app.renderer.width,
      screenHeight: this.app.renderer.height,
    });

    // Establish the "enemy" team — for v1, that's any team other than
    // team_a (the player). Used for the portrait horizontal-flip so
    // enemy portraits face toward the player.
    const playerTeam: TeamId = state.units.values().next().value?.team ?? ('team_a' as TeamId);

    for (const unit of state.units.values()) {
      // Per ADR-0058: `maxMp` is queried per-frame via
      // `runModifyStatQuery` in `applyVisualState`, so equipment /
      // status contributions compose live. No mount-captured cache.
      const sprite = new UnitSprite(unit, { enemyTeam: unit.team !== playerTeam });
      this.sprites.set(unit.id, sprite);
      this.unitLayer.addChild(sprite.container);
      this.animator.initSnapshot(unit.id, {
        position: positionCenter(unit.position),
        facing: unit.facing,
        hp: unit.vitals.hp,
        // maxHp / maxMp are not on the snapshot — the renderer live-reads
        // both per-frame via `runModifyStatQuery` in `applyVisualState`
        // (ADR-0058 for maxMp, S31.5 polish #6 for maxHp; the dead
        // snapshot `maxHp` field was removed in S33.5A / ADR-0074).
        mp: unit.vitals.mp,
        ko: unit.vitals.hp <= 0,
        flash: 0,
      });
    }

    // Kick off portrait asset loads in the background. The renderer
    // stays responsive (sprites show as colored circles until textures
    // arrive). Missing or failed assets fall through to the circle —
    // never blocks gameplay.
    void this.loadPortraitAssets(state);

    // Same pattern for terrain textures (ADR-0054). Per-terrain-type
    // pools resolve independently and overlay onto the colored-fill
    // fallback the moment they're ready. Tiles whose terrain has no
    // manifest entry stay bare; the fallback rect is the universal
    // ground state.
    void this.loadTerrainAssets(state);

    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
    // Render once so the canvas isn't blank before the ticker fires.
    this.applyVisualState();
    this.camera.apply(this.world);
  }

  // Async portrait loader. For each class present in the initial state,
  // load the registered PNG URL via Pixi `Assets.load` and attach the
  // texture to every UnitSprite of that class. Errors per-class are
  // swallowed (logged in dev) so one bad asset doesn't break the
  // whole battle; the affected unit keeps its circle fallback.
  private async loadPortraitAssets(state: GameState): Promise<void> {
    const classesPresent = new Set<ClassId>();
    for (const u of state.units.values()) classesPresent.add(u.classState.currentClass);

    const loads: Promise<void>[] = [];
    for (const classId of classesPresent) {
      const url = PORTRAIT_URLS.get(classId);
      if (url === undefined) continue;
      loads.push(
        Assets.load(url)
          .then((texture: Texture) => {
            this.portraitTextures.set(classId, texture);
            // Apply to existing sprites of this class.
            const currentState = this.lastState;
            if (currentState === null) return;
            for (const u of currentState.units.values()) {
              if (u.classState.currentClass !== classId) continue;
              this.sprites.get(u.id)?.setPortrait(texture);
            }
          })
          .catch((err: unknown) => {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.warn('[renderer] portrait load failed for', String(classId), err);
            }
          }),
      );
    }
    await Promise.all(loads);
  }

  // Async terrain texture loader (ADR-0054). For each unique terrain
  // type present on the loaded map, look up its pool in TERRAIN_MANIFEST
  // and load every variant URL via Pixi `Assets.load`. When all variants
  // for a type resolve, hand them to TileLayer so it can overlay sprites
  // per tile with deterministic variant selection. Errors per-type are
  // swallowed (logged in dev) — a missing/broken variant leaves the
  // colored-fill fallback in place for that terrain.
  private async loadTerrainAssets(state: GameState): Promise<void> {
    const terrainTypesPresent = new Set<TerrainType>();
    for (const tile of state.map.tiles) terrainTypesPresent.add(tile.terrain);

    const loads: Promise<void>[] = [];
    for (const terrainType of terrainTypesPresent) {
      const pool = terrainTexturePoolFor(terrainType);
      if (pool === null) continue;
      loads.push(
        Promise.all(pool.map((url) => Assets.load(url) as Promise<Texture>))
          .then((textures) => {
            this.terrainTextures.set(terrainType, textures);
            const currentState = this.lastState;
            if (currentState === null) return;
            this.tileLayer.applyTerrainTextures(
              currentState.map,
              terrainType,
              textures,
              currentState.rng.masterSeed,
            );
          })
          .catch((err: unknown) => {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.warn(
                '[renderer] terrain texture load failed for',
                String(terrainType),
                err,
              );
            }
          }),
      );
    }
    await Promise.all(loads);
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

  // Set the set of units whose hover-counterpart ring is currently lit.
  // Driven from the UI's hover handlers (action log row, queue tower
  // mini-card). Pass an empty array / set to clear.
  setCounterpartUnits(ids: Iterable<UnitId>): void {
    this.counterpartUnits = new Set(ids);
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
    // Bug 1 instrumentation (Session 24.5): if a sprite is rendered at
    // (tileX, tileY) but `unitAt(state, tileX, tileY, top.layer)` returns
    // null, there's a layer-mismatch between the unit's `position.layer`
    // and the topmost-tile-layer the hit-test uses. Catches the case
    // where a multi-layer map's unit sits at layer 0 but the hit-test
    // resolves to a higher layer.
    if (import.meta.env.DEV && occupant === null) {
      for (const u of this.lastState.units.values()) {
        if (u.position.x === tileX && u.position.y === tileY && u.vitals.hp > 0) {
          // eslint-disable-next-line no-console
          console.debug(
            '[hit-test] occupant mismatch at',
            `(${tileX},${tileY})`,
            '— sprite layer',
            u.position.layer,
            'vs hit-test layer',
            top.layer,
            'unit',
            String(u.id),
          );
          break;
        }
      }
    }
    return { pos, occupant };
  }

  // ---- per-frame ----

  private tick(dtMs: number): void {
    if (!this.paused) {
      this.animator.tick(dtMs);
      this.updateCameraTarget();
      this.syncChargedTileHighlight();
    }
    // Camera input keeps working while paused — the user can still pan
    // and zoom around to inspect the frozen state.
    this.camera?.update(dtMs);
    this.applyVisualState();
    this.camera?.apply(this.world);
  }

  // Sync the highlight overlay channel with the animator's current
  // tile-highlight anim. Session 26.5 (item #5) — the pre-resolve cue
  // for charged actions. Repaints only on transitions (anim start /
  // anim end) to avoid driving the overlay each frame.
  private syncChargedTileHighlight(): void {
    const tiles = this.animator.getTileHighlightPositions();
    const key = tiles.map((t) => `${t.x},${t.y},${t.layer}`).join('|');
    if (key === this.lastTileHighlightKey) return;
    this.lastTileHighlightKey = key;
    if (tiles.length === 0) {
      this.highlightLayer.setOverlay([], 'none');
    } else {
      this.highlightLayer.setOverlay(tiles, 'aoe');
    }
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
      // Session 31.5 polish #5: MP now reads from the animator's
      // snapshot (settled at action finalize) so MP changes move in
      // sync with the action's flash, not ahead of it. Statuses still
      // snap to current engine state — fixing that would require the
      // animator to track per-unit status arrays through every action
      // type that mutates them (system_apply_status, status_tick,
      // status_remove); deferred per the carry-forward.
      const unit = this.lastState?.units.get(unitId);
      const mp = snap.mp;
      // Per ADR-0058: read effective `maxMp` per-frame via
      // `runModifyStatQuery` so equipment / status contributions
      // compose live. Falls back to `Math.max(mp, 1)` when state /
      // catalog are absent (mid-mount transient).
      let maxMp = Math.max(mp, 1);
      if (unit !== undefined && this.lastState !== null && this.catalog !== null) {
        const queried = runModifyStatQuery(this.lastState, this.catalog, {
          unit,
          statName: 'maxMp',
          baseValue: unit.baseStats.maxMpBase,
        });
        maxMp = Math.max(1, Math.floor(queried));
      }
      const statuses = unit !== undefined ? this.computeStatusBadges(unit) : [];
      // Session 31.5 polish #6: maxHp lifted to a per-frame read via
      // `runModifyStatQuery` (matching maxMp's pattern, ADR-0058). The
      // snapshot's `maxHp` was captured at mount as `unit.baseStats.maxHpBase`
      // — equipment contributions (Wizard's Robe +40 maxHp etc.) were
      // not reflected, so a Mage's HP bar fill fraction read against the
      // wrong denominator and the bar drew too full.
      let maxHp = Math.max(snap.hp, 1);
      if (unit !== undefined && this.lastState !== null && this.catalog !== null) {
        const queried = runModifyStatQuery(this.lastState, this.catalog, {
          unit,
          statName: 'maxHp',
          baseValue: unit.baseStats.maxHpBase,
        });
        maxHp = Math.max(1, Math.floor(queried));
      }
      sprite.setVisualState({
        position: snap.position,
        facing: snap.facing,
        hp: snap.hp,
        maxHp,
        mp,
        maxMp,
        ko: snap.ko,
        flash: snap.flash,
        active: activeId === unitId,
        statuses,
        counterpart: this.counterpartUnits.has(unitId) ? 1 : 0,
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
