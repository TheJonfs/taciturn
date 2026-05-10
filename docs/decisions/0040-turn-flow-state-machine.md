## ADR-0040: Turn-flow state machine — pure reducer plus React glue

**Status:** Accepted
**Date:** 2026-05-10

## Context

Session 23 reintroduces player interaction after Session 22's visualization-only posture. The player drives `team_a` through a per-turn input sequence: pick top-level action (Move / Act / Wait), pick command set, pick ability, pick target, optionally confirm, watch animation, repeat until budget exhausts.

`docs/twentyOneDesign/battle-ui-architecture.md` §"Decision Loop State Machine" prescribes seven states with explicit cancellation back-paths. Three structural questions:

1. **Where does the state live?** React-only (one `useState` per substate) collapses cancellation logic into ad hoc conditionals. A non-React state module is testable in isolation and decouples transitions from rendering.

2. **How do side effects (legal-target painting, tile-click wiring, controller submission) hang off the state machine?** They need access to the renderer + engine state + uiController, all of which are React-owned. They also need to fire on transitions, not just on state.

3. **Is the pause overlay another state in the machine, or an orthogonal flag?** ESC behavior differs depending on the active sub-state (cancel out of picking vs open pause), so the answer affects how ESC is dispatched.

## Decision

**Two-layer split.** The state machine is a *pure reducer* in `src/ui/turn-flow.ts`; a React hook `src/ui/use-turn-flow.ts` owns the reducer instance, derives auxiliary memos (legal moves, legal targets, AoE footprint), and fires side effects (highlight repaints, click/hover handler wiring, uiController submissions).

**States** (`TurnFlowState` discriminated union):

```
idle → action-menu → move-select → animation → action-menu | idle
                  → command-set-select → ability-list → target-select → await-confirm → animation → ...
                                       (skipped when single command set)
                                                                     (skipped when settings.confirmStep === 'skip')
                  → animation (Wait)
```

`action-menu` is the per-turn entry. The cancellation backstack is encoded by *carrying context forward in the state*: `ability-list` carries `{commandSetId, commandSetCount}`; `target-select` carries both plus `{abilityId, hoverTarget}`; `await-confirm` carries all of the above plus the proposed action. Cancel from any state knows its predecessor without a separate history stack.

The `await-confirm` state is gated by the `Settings.confirmStep` preference (`'confirm'` vs `'skip'`). When skip-confirm is selected, target picks transition `target-select → animation` directly.

**Lifecycle events override current state:** `activeTurnStart` always returns to `action-menu`; `activeTurnEnd` always returns to `idle`; `animationEnded { stillOurTurn }` returns to `action-menu` or `idle` based on whether the active unit is still ours. The hook dispatches these from React effects that watch the engine state and the renderer's idle flag.

**Pause is an orthogonal flag**, not a state. It lives at the BattleView level as a `useState<boolean>`. ESC dispatch in BattleView decides per current turn-flow state:

- ESC in `move-select | command-set-select | ability-list | target-select | await-confirm` → `turnFlow.cancel()` (back out one step).
- ESC in `idle | action-menu | animation` → toggle pause overlay.
- ESC while pause overlay open → close (Resume).

This matches the design doc's intent ("every sub-state has an obvious back path") without making pause-handling state-machine-aware.

**Animation drain detection.** The hook polls `renderer.isIdle()` via `setInterval(..., 16)` while in `animation` state. `setInterval` was chosen over `requestAnimationFrame` because rAF is suspended in backgrounded tabs (and in headless preview), which would strand the state machine in `animation` even though the orchestrator and renderer had finished. `setInterval` is throttled when backgrounded but still fires, so the state machine drains.

**Pure-reducer tests** in `src/ui/turn-flow.test.ts` cover every documented transition (25 tests). The reducer is independent of React, the renderer, the engine, and the uiController — feed `(state, event)`, get `(newState)`.

## Why this shape

- **Pure reducer** is *the* testable surface. State-machine bugs are most often transition bugs, not side-effect bugs; isolating transitions from side effects means tests catch the right class of error and never need DOM/canvas plumbing.

- **State-carries-context backstack** beats a separate history stack: explicit, single source of truth, no question of "what was the prior state?" when cancelling. The cost is wider state types; the benefit is no out-of-band data structure to keep aligned.

- **Lifecycle events override** rather than threading through sub-states means a turn boundary doesn't have to walk the cancellation stack — it just resets. Mid-pick turn-boundaries shouldn't be a normal occurrence anyway, but the override makes the corner case safe.

- **Pause as orthogonal flag** avoids combinatorial explosion (paused-while-picking-move, paused-while-target-select, etc.). The state machine sees pause as "the world froze," not "I'm in a new state."

- **setInterval over rAF** is a small operational choice that surfaces a real failure mode (backgrounded tab) without changing the architecture. The 16ms interval matches a 60fps frame budget; perceived latency is identical to rAF.

## Consequences

- **Single source of truth for "what's the player doing right now."** Components read `turnFlow.state.kind` and render accordingly; they don't track local "picking" flags.

- **Cancellation always works.** Every state's prior-state is computable from its own context; ESC and Cancel buttons share the same dispatch.

- **Settings.confirmStep wires through one place.** Skip-confirm flips a single conditional in the reducer's `target-select` → next-state transition.

- **Side effects are localized.** The hook is one ~350-line module that holds all the imperative wiring (highlights, click handler, hover handler, submission). Components stay declarative.

- **New picking states (e.g., facing-on-wait per WAIT-CONFIRM in the design doc) extend by adding union variants.** The cancellation backstack convention scales — new states declare the context they need to back out.

## Alternatives considered

- **One `useState` per substate in a React component.** Rejected — cancellation becomes a tangle of conditionals, transitions are scattered across event handlers, tests can't exercise transition correctness without rendering React.

- **State machine in a third-party library (XState, etc.).** Considered. Rejected — a 200-line reducer is right-sized for v1, and the library would add a dependency without removing the surface area we actually care about (the React glue and side effects, which are the larger share of the work). Revisit if the state graph grows past ~15 states.

- **Pause as a TurnFlowState variant.** Rejected — every other state would need to know whether it's currently paused, and pause behavior (halt animator, halt pump) is BattleView-level concern that has nothing to do with the turn-flow's transition semantics.

- **rAF-based animation drain.** Initial implementation. Replaced with setInterval after preview verification surfaced backgrounded-tab stranding.

- **Letting the orchestrator pump dispatch animationEnded.** Considered. Rejected — the pump can't easily know which controller is on; coupling animation-drain to the pump would force a callback through orchestrator → controller → hook. The hook's local poll is simpler and the dispatch is idempotent (the state machine ignores re-fires while in `action-menu`).
