## ADR-0037: UI state subscription via orchestrator-pump-driven setState

**Status:** Accepted (retrospective — pattern was put in place during sessions 10-12 and confirmed in Session 22)
**Date:** 2026-05-10

## Context

The battle UI presents engine state to the player. Three subscription patterns were possible:

(a) **UI polls / re-reads on every frame from the orchestrator.** Simple but wasteful — React re-renders 60 times per second whether anything changed or not.

(b) **UI subscribes to state-change events emitted by the orchestrator.** An event-emitter or pub/sub layer sits between the engine and React. Adds a layer; clear semantics around which events fire when.

(c) **UI receives state on each commit through the orchestrator pump's existing return value.** The orchestrator's `step()` already returns `{ committed, newState, done }`; the pump that drives it can `setLatestState(step.newState)` immediately after a commit, with React naturally re-rendering on next frame.

CLAUDE.md fixes two relevant constraints: "All state changes happen through the reducer" (ground rule 2 — UI cannot mutate state) and "engine knows nothing about rendering" (ground rule 1 — the engine cannot publish events to a React-aware bus). Anything bridging the two has to live in the integration layer.

The pump architecture, established during the initial renderer sessions, drives the orchestrator inside the Pixi ticker:

```
ticker:
  if !renderer.isIdle: return
  step = orchestrator.step()
  if step.committed.length > 0:
    renderer.playActions(step.committed, step.newState)
    setLatestState(step.newState)
  if step.done: finished = true
```

The animator chews through the committed actions over multiple frames (visual tweens); the next pump fires only when the animator reports idle, which gates how fast the engine advances. React state updates happen at most once per commit — typically once per turn-and-its-reactions cycle, far below 60Hz.

## Decision

Engine state reaches React through the **orchestrator pump's per-commit `setLatestState`** call (option c). Concretely:

- The pump runs inside the Pixi ticker (not a React effect or `requestAnimationFrame` loop separate from the renderer).
- Each call to `orchestrator.step()` returns the post-commit `GameState` if anything was committed.
- The pump pushes the new state to React via `setLatestState(step.newState)` once per commit.
- React-driven HUD components (`BattleHud`, `QueueTower`, etc.) receive state as a prop; their re-render cost is bounded by commit frequency, not frame frequency.
- The engine never imports React. The renderer never imports React. React never imports renderer internals beyond the public `BattleRenderer` API.

The renderer's per-frame visual state (animator-driven sprite tweens) is independent from the React state. The renderer reads its own `lastState` snapshot for any frame-level lookups (e.g. status-badge synthesis in `applyVisualState`); React reads `latestState` for HUD content. Both come from the same `step.newState` written at the same time.

### Rejected alternatives

- **(a) UI polls every frame.** Wasteful; React re-renders 60×/sec. Pixi's ticker pacing makes this trivially avoidable since the pump already knows when state advances.

- **(b) Event-emitter / pub-sub between engine and React.** Adds a bus layer. The engine cannot publish to it (ground rule 1), so the bus would live at the orchestrator or app tier — duplicating what the pump already returns. The pump's commit signal *is* the state-change event; serializing it through a bus is indirection without payoff.

- **Run the pump in `requestAnimationFrame` separate from Pixi's ticker.** Two competing per-frame loops complicate animator pacing (the renderer reports idle based on its tweens; rAF doesn't know about that). Sharing the ticker keeps the cadence coherent.

## Consequences

- **React re-renders happen ~once per commit, not 60×/sec.** HUD state derivations (active unit lookup, queue projection) run on commit, which is the natural granularity for the design doc's "what happened just now" panels.

- **Orchestrator pump is the single source of state advancement.** Any future controller (UI, AI tier, scripted) plugs into the same pump; nothing else advances engine state. This composes with ADR-0035 (controllers pre-filter through `runOnActionAttempted` before returning a commit decision).

- **Renderer animator and React HUD see consistent state.** Both read from the same `newState` snapshot the pump distributed. There's no race between "renderer says HP is 80" and "HUD says HP is 50."

- **Mid-animation visual divergence is bounded.** The animator tweens HP from 100 → 60 over a flash; during that interval the React HUD already shows the post-commit numeric values (current MP, statuses). For damage-pacing fidelity the visual lags slightly behind state — the brief explicitly accepts this for Session 22 ("the visual fidelity is 'the right values reach the screen,' not 'with smooth animations'"). Session 23+ can extend the animator to drive specific HUD-side fields if needed.

- **Pause-and-resume is naturally supported by gating the pump.** A future ESC pause (per the design doc) sets `paused = true` in the pump closure; the engine simply doesn't advance, the renderer's animator finishes whatever's in flight, and React state stays put. No special "pause API" on the engine.

- **The pump is dev-debuggable via `__taciturnDebug.tick(n)`.** [`BattleView.tsx`](../../src/app/BattleView.tsx) installs a window-attached debug surface in dev builds (Vite tree-shakes it from production) so a paused tab — Pixi throttles its ticker when hidden — can be advanced from the preview console. Useful for the verification workflow when the canvas is offscreen.

## Related

- CLAUDE.md — ground rules 1, 2, 3 (engine independent of UI; immutable state; actions are the unit of state change).
- ADR-0036 — React + Pixi integration pattern and module boundary.
- ADR-0035 — controllers pre-filter on `runOnActionAttempted` (the orchestrator pump's contract with controllers).
- ADR-0009 — action lifecycle and reducer (the `commitAction` returns the post-commit state used here).
