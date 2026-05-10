## ADR-0039: `canCommitAction` promoted to a shared engine helper

**Status:** Accepted
**Date:** 2026-05-10

## Context

ADR-0035 established that controllers must run `runOnActionAttempted` against their proposed actions as a pre-flight check before submitting to the orchestrator. `validateAction` is pure (range, target, budget — no hook side effects), but the engine also runs `runOnActionAttempted` at commit time; status effects like Don't Move, Don't Act, and Silence block actions there, not in validation. Without the pre-flight, controllers propose structurally-valid actions that the orchestrator then rejects with a throw.

ADR-0035 kept the helper *duplicated* across the two controllers that existed at the time (`src/ai/basic.ts`, `src/app/demo/controller.ts`), with explicit "two callers is fine; promote on the third." Session 23 adds the third commit-emitter — the UI controller (driven by the turn-flow state machine in `src/ui/use-turn-flow.ts`). That's the trigger.

## Decision

Promote `canCommitAction` to **`src/engine/actions/can-commit.ts`**, exported via `src/engine/actions/index.ts` and (transitively) the engine barrel. Signature unchanged from the duplicates:

```ts
canCommitAction(state, catalog, actor, action) → boolean
```

Internals are also unchanged: `validateAction(state, action, catalog).valid && runOnActionAttempted(state, catalog, { unit: actor, action, isReaction: false }).kind === 'allowed'`.

All three callers — `src/ai/basic.ts:206-234`, `src/app/demo/controller.ts:30-54`, and `src/ui/use-turn-flow.ts` (new) — import from the shared module. The two existing private definitions are deleted.

`runOnActionAttempted`'s purity (handlers receive no state, return `ActionAttemptResult` only) makes this safe — the pre-flight has the same purity profile as validation. The reducer's `runPreHook` continues to call `runOnActionAttempted` independently at commit time; the controller-side check is a filter, not a replacement.

## Why now and not earlier

Two callers is "minor duplication"; three callers is "drifting standard." Promoting at the third controller's arrival is the cheapest moment — the AI controller and the demo controller had already converged on a verbatim-identical implementation, the UI controller would inherit the same need, and the alternative (three independent copies) creates three drift-prone sites for a one-line semantic that absolutely must stay aligned with the engine's hook firing.

ADR-0035 anticipated this trigger explicitly. This ADR closes that anticipation.

## Consequences

- **One source of truth** for the controller pre-flight. Any future tweak to the "what does a controller need to check" semantics edits one file. Tests in `src/engine/actions/can-commit.test.ts` cover the three cases: validation rejects → false; hook blocks → false; both pass → true.

- **No behavior change for AI or demo controller.** The AI integration test (`ai-controller.integration.test.ts`, calibrated to `demoBattle`'s 6×6 board) stays green — the shared helper is byte-equivalent to the deleted duplicates.

- **UI controller now mechanically aligned with ADR-0035.** The turn-flow hook calls `canCommitAction(state, catalog, activeUnit, proposedAction)` on tile-click before pushing into `uiController.submit`. If the pre-flight fails (Don't Move blocks a Move, Silence blocks an Attack), the UI dispatches `cancel` rather than enqueueing an action the orchestrator would reject.

- **Future controllers** (networked play, replay-driver) inherit the same call site.

## Alternatives considered

- **Leaving duplicates in place.** Rejected — three identical copies of a ~10-line helper that must stay aligned with engine hook semantics is exactly the failure mode ADR-0035's "promote on third caller" rule was meant to prevent.

- **Putting the helper in `src/engine/hooks/`.** Considered — the helper's center of gravity is `runOnActionAttempted`, which lives in `hooks/`. Rejected because the helper is *about actions* — it composes validation (an `actions/` concept) with hook firing (a `hooks/` concept), and `actions/` is the natural home for a controller-side action-related utility. The reducer's `runPreHook` in `commit.ts` stays in `actions/` for the same reason.

- **Folding the check into `validateAction`.** Rejected — validation is structural and pure, and ADR-0035 explicitly captured why hook firing belongs separately. Mixing them re-creates the problem the controller pre-flight pattern was designed to solve.
