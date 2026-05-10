## ADR-0038: Camera state lives in a renderer-owned controller with a two-state machine

**Status:** Accepted
**Date:** 2026-05-10

## Context

Sessions 10-21 used a minimal camera: a single world-space focal point that lerped each frame toward the active unit's snapshot position, with the world container's translation set per-tick to keep the focal at screen center. No user input, no zoom, no fit-map starting view, no boundary clamping.

Session 22's brief calls for the camera to graduate to user-driven pan + zoom while preserving the auto-follow-on-turn-start behavior. `docs/twentyOneDesign/battle-ui-architecture.md` ("Camera and Map Navigation") prescribes a richer state machine, fit-map starting view, WASD pan, mouse-wheel zoom toward cursor, boundary constraints, and auto-pan re-engagement on turn-start.

Three structural questions:

1. **Where does camera state live?** The renderer (close to the Pixi world container's transform), the React UI (where input events arrive), or a separate camera module shared between them? The design doc explicitly answers — "Camera state with smooth interpolation. Renderer-side first-class concern" — but only as a note. This ADR fixes it.

2. **How does input reach the camera?** WASD comes from the window keyboard; wheel comes from the canvas DOM element; future buttons (+/-) come from React. Whichever pattern is chosen has to handle all three input sources without leaking implementation details across the React / renderer boundary.

3. **What's the state machine?** The design doc names IDLE / AUTO-INTERPOLATING / USER-DRIVEN. Implementing all three faithfully adds complexity (separate animation-target tracking when not auto-following, handling of in-progress interpolation cancelation, etc.). The brief allows a Session-22-appropriate simplification.

## Decision

A new module **`src/renderer/camera-controller.ts`** owns camera position + zoom + mode. The `BattleRenderer` instantiates one in `mount()`, wires its `update()` into the per-frame tick, and applies its transform to the world container via `apply(world)`. Pure-math accessors (`getPosition`, `getZoom`, `getMode`) make the controller unit-testable without Pixi (see `camera-controller.test.ts` — 16 tests covering fit-map, zoom-toward-focal, pan integration, mode transitions, bounds clamping).

**Two-state machine** rather than three. AUTO_FOLLOWING and USER_DRIVEN are the modes; the design-doc IDLE / AUTO-INTERPOLATING distinction collapses into "AUTO_FOLLOWING with no target = held still; AUTO_FOLLOWING with a target = lerping toward it." The third logical state is encoded by the `autoTarget === null` condition. This simplification is right-sized for Session 22 and easy to extend later if smooth-interpolation animation tracking diverges from the simple per-tick lerp.

State transitions:

```
   AUTO_FOLLOWING ──── pan input / wheel zoom ──→ USER_DRIVEN
        ▲                                              │
        └────── BattleRenderer.engageAutoFollow() ─────┘
                  (called when active-unit changes)
```

`BattleRenderer` is the only caller of `engageAutoFollow()`. It detects active-unit transitions via the animator's `getActiveUnit()` return crossing from null/X to Y, treats that as the turn-start re-engagement event, and calls `engageAutoFollow()` once. The renderer continues feeding `setAutoFollowTarget(activeUnitSnapshotPosition)` every tick so the camera tracks mid-turn movement when in AUTO_FOLLOWING.

**Input dispatch** flows through `BattleRenderer` passthroughs:

- `setPanInput(input: PanInput)` — keyboard handler in `BattleView` translates WASD/arrow keydown/keyup into a 4-flag struct and pushes it on every change.
- `applyZoomAt(deltaFactor, focalPointScreen)` — wheel handler in `BattleView` converts wheel delta into a multiplicative factor and computes focal point from cursor position.
- `setScreenSize(w, h)` — `ResizeObserver` on the host element pushes new dimensions when the canvas resizes.
- `fitMap()` — exposed for the future "recentre" UI button (no caller in Session 22; debug surface only).

**Coordinate model:**

- World space: pixel coordinates of the map plane. (0,0) is the top-left of tile (0,0). Map size in world pixels is `mapWidth * tileSize × mapHeight * tileSize`.
- Camera position is a world-space point that ends up under the screen-space center.
- Zoom factor is uniform (no anamorphic scaling).
- Transform: `world.scale = zoom; world.position = (screenCx - position.x * zoom, screenCy - position.y * zoom)`.

**Zoom-toward-focal** preserves the world point under the focal across the zoom change. The math:

```
worldUnderFocal = position + (focal - screenCenter) / oldZoom
position'        = worldUnderFocal - (focal - screenCenter) / newZoom
```

For zoom-toward-center, focal == screenCenter, and `position` stays put. Used identically for both wheel-zoom (focal = cursor) and the future +/- buttons (focal = screen center).

**Pan speed** scales inversely with zoom (`tilesPerSec * tileSize / zoom`) so panning across the map at overview is reasonable while panning when zoomed in is precise. Defaults: 8 tiles/sec at zoom 1; configurable via constructor options.

**Bounds clamping:** strict — camera position cannot leave the map (`[0, mapWidth*tileSize] × [0, mapHeight*tileSize]`). The design doc allows ~2 tiles of overshoot margin; implementing that adds a second knob to tune and the visual benefit is marginal. v1 ships strict; relax later if playtest reveals demand.

**Min zoom = fit-map.** The user cannot zoom out beyond what fits the map in the viewport — there's no useful information past that point and it would push the map into the corner of the screen. Max zoom is configurable (default 3, meaning a single tile at ~3× its unzoomed pixel size).

### Rejected alternatives

- **Three-state machine (IDLE / AUTO-INTERPOLATING / USER-DRIVEN).** The IDLE state is "held still after a previous interpolation completes." With per-tick lerp toward `autoTarget`, "held still" emerges naturally when the position has converged to the target — no separate state needed. Adding it would force `update()` to track convergence threshold + transition timing. Defer until interpolation animation needs to differ structurally from "lerp every tick."

- **Camera state in React.** Considered for symmetry with HUD state. Rejected: the camera transform applies to a Pixi `Container`, which lives outside React's render tree. React would write camera state, then call out to Pixi to apply — which is exactly what the renderer already does internally. Putting the state in React adds a hop.

- **Camera state in a separate top-level module.** Considered for testability. Rejected: the controller already exposes pure math (`getPosition`, `getZoom`, `applyZoom`, etc.) testable without Pixi. The only Pixi side-effect is `apply(world)` and `setScreenSize` (which reads dimensions, no Pixi state). Keeping it in `src/renderer/` matches the design doc's instruction and groups it with the Pixi-aware code that consumes it.

- **Per-pixel pan delta from keyboard rather than time-integrated.** Considered for code simplicity. Rejected: WASD pan needs to feel smooth, which requires `dx = speed * dtMs` integration. Time-integrated pan handles variable frame rate and per-frame physics naturally.

## Consequences

- **The camera controller is unit-testable.** 16 tests in `src/renderer/camera-controller.test.ts` cover the math without instantiating Pixi. Session 22 ships full coverage; later sessions extending the controller (e.g. adding smooth interpolation animation tracking) extend the test suite.

- **The renderer is the single owner.** No other module reads or writes `position` / `zoom` / `mode`. React communicates by calling renderer passthroughs. The orchestrator never knows the camera exists.

- **Adding camera features is local.** The +/- buttons (Session 24-ish), edge-of-screen pan, the recentre UI button, charged-action-resolve auto-pan — all extend `CameraController`'s API and are wired from `BattleView` or the renderer's tick. No engine changes; no UI architecture changes.

- **`BattleRenderer.mount()` now requires the catalog.** A side effect of also adding status-badge polarity lookup in this session — same wave of `mount()` API changes. The catalog is the only "engine context" the renderer needs, and only for visualization-time lookups (status type tags). Future renderer features (terrain effects, ability AoE preview) may extend; the catalog argument scales naturally.

- **The legacy `cameraPos` / `cameraTarget` / inline `applyCamera` code in BattleRenderer is removed.** Replaced by the controller. The `mapCenter` helper is also removed (no longer needed — the controller's fit-map computation replaces the "drift back to map center between turns" fallback).

- **`CAMERA_LERP` constant remains.** Used by the controller in AUTO_FOLLOWING mode. Other camera-tunable constants (max zoom, pan speed, fit padding) are constructor options on the controller rather than module-level constants — they're per-camera-instance not per-renderer.

## Related

- `docs/twentyOneDesign/battle-ui-architecture.md` — "Camera and Map Navigation" section (the design this implements).
- ADR-0036 — React + Pixi integration pattern (the camera lives renderer-side per that boundary).
- `src/renderer/camera-controller.ts` — implementation.
- `src/renderer/camera-controller.test.ts` — unit-tested math.
