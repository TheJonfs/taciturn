## ADR-0036: React + PixiJS integration pattern and the React / Pixi / engine module boundary

**Status:** Accepted (retrospective — pattern was put in place during sessions 10-12 and confirmed in Session 22)
**Date:** 2026-05-10

## Context

The Phase A battle UI runs as a browser app combining a React HUD (menus, panels, side overlays) with a PixiJS canvas (tiles, units, animations). CLAUDE.md fixes the broad shape — "React handles HUD elements; PixiJS handles the battle map canvas" — but doesn't pin the integration mechanism. The Session 22 brief (`docs/twentyOnePlanning/session-22-brief.md`) called for an explicit ADR on the choice because it propagates forward through Sessions 23-24 (interaction, forecast, projection), 32-37 (deployment + team builder), and 38+ (post-MVP polish).

Three integration patterns were available:

(a) **A community React-Pixi binding library** (e.g. `@pixi/react`). Declarative authoring, JSX-style scene graph. Adds a peer dependency that tracks Pixi version compatibility, bundle weight, and a layer of abstraction the renderer authors must learn alongside Pixi itself.

(b) **Vanilla PixiJS managed by React refs and a `useEffect` lifecycle hook.** The React component owns mounting / resize / unmount via `useEffect`; everything inside the canvas is imperative Pixi code (Containers, Graphics, scene graph). No third-party adapter to maintain.

(c) **A custom adapter** between React's reconciler and Pixi's scene graph. All the upsides of (a) without the dependency, but with the maintenance cost of writing the adapter ourselves.

Sessions 10-12 implemented option (b) when wiring the first renderer prototype against the demo battle. Session 22 reviewed the choice as part of converging on the design-doc layout (`docs/twentyOneDesign/battle-ui-architecture.md`) and confirmed it without changes.

## Decision

**React + Pixi integration:** Vanilla PixiJS managed by React refs + a single `useEffect` lifecycle hook. The pattern is concretely:

- A top-level React component (`BattleView` in [`src/app/BattleView.tsx`](../../src/app/BattleView.tsx)) holds a `containerRef` to a `<div>` host. Inside `useEffect` it constructs a Pixi `Application`, calls `app.init({ resizeTo: host, ... })`, appends `app.canvas` to the host, mounts a `BattleRenderer` (which builds its tile / unit / highlight / animator sub-systems on the `app.stage`), and registers cleanup that destroys the Pixi app and removes the canvas on unmount.
- React owns: layout, side-panel content, top bar, action menu (when interaction returns), settings overlay, modals, forms.
- PixiJS owns: tiles, units, animations, world-space overlays (highlights, AoE preview), camera transform.
- React communicates *into* Pixi via direct method calls on the renderer (e.g. `setHighlights`, `setPanInput`, `applyZoomAt`). Pixi communicates *out* via callbacks set by React (e.g. `setOnTileClick(handler)`).

**Module boundary** (anchored on CLAUDE.md ground rule 1 — "engine knows nothing about rendering"):

- `src/engine/` does not import from `src/renderer/` or `src/ui/` or `src/app/`. The engine is renderer-agnostic.
- `src/renderer/` imports from `src/engine/` (types, queries) but not from `src/ui/` or `src/app/`. The renderer is React-agnostic — it works with any host that can construct a `Pixi.Application` and provide it.
- `src/ui/` imports from `src/engine/` (types, queries for read-only display) and may *type-import* from `src/renderer/` (for the `BattleRenderer` interface when wiring a prop), but doesn't reach into renderer internals.
- `src/app/` is the integration tier — imports from all three (engine, renderer, ui) and orchestrates the lifecycle. Components in `src/app/` are the only ones that hold both a renderer instance and a React tree.

### Rejected alternatives

- **(a) Community React-Pixi binding library.** Declarative authoring is appealing for static scene graphs, but the battle canvas is animation-heavy (tweening positions, hit flashes, status badge updates) and the imperative Pixi API maps better to the animator's per-frame mutation model. The binding adds bundle weight, ties the project to that library's release cadence, and means renderer authors learn two abstractions (the binding + Pixi). Pure-Pixi keeps the surface focused on the engine ↔ renderer contract.

- **(c) Custom adapter.** Maintenance burden vs. payoff is poor. The renderer's scene graph is small and stable (tiles + units + highlights + camera world container) and doesn't change shape between sessions. An adapter would solve a problem we don't have.

- **Letting React drive the Pixi ticker.** Considered as a way to unify the per-frame loop. Rejected: Pixi's ticker is the natural per-frame source for canvas animation, and React's `useEffect` + state-update model isn't designed for 60fps mutation. Bridge instead: the orchestrator's pump runs *inside* the Pixi ticker (not in a React effect), and the result of each commit syncs to React via `setState` once per commit (see ADR-0037).

## Consequences

- **The renderer is testable in isolation against any host.** A future test harness or storybook can construct a `Pixi.Application` and mount the renderer without React; the renderer's contract is "give me a state and committed actions; I'll draw."

- **The boundary is enforceable by `import` audit.** A future lint rule (or pre-commit hook) can reject any file in `src/engine/` that imports `src/renderer/` or `src/ui/`. Worth adding when the engine grows further; today the convention is enforced by reviewer eye.

- **Adding new HUD surface is React-only work.** Top bar, action log, side panels, results screen — all are React components. Pixi changes only when the *canvas-side* visual language changes (new sprite kinds, new overlays).

- **Adding new canvas-side visuals is renderer-only work.** Status badges (Session 22), damage number popups (Session 23/24), animation polish, particle effects — all live in `src/renderer/` and don't touch React. The renderer extends without HUD churn.

- **Pixi version upgrades are unilateral.** Bumping Pixi (currently 8.6.6) doesn't require a peer-binding update. The renderer's import surface is the API to track.

- **`@app/`, `@engine/`, `@ai/`, `@renderer/`, `@ui/`, `@content/` aliases formalize the directionality.** Configured in `vite.config.ts`. Any reverse import is a visible signal in code review.

## Related

- CLAUDE.md — ground rules 1 and 9 (engine knows nothing about rendering; module boundaries).
- `docs/architecture/architecture-overview.md` — renderer vs. UI vs. engine layering.
- `docs/twentyOneDesign/battle-ui-architecture.md` — the design doc whose layout this pattern services.
- ADR-0037 — UI state subscription pattern (how engine state reaches React).
- ADR-0038 — camera architecture (renderer-owned camera state).
