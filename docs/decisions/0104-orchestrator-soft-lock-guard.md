## ADR-0104: Orchestrator soft-lock guard for repeated rejected actions

**Status:** Accepted
**Date:** 2026-06-11

## Context

A controller-submitted action can be refused by the engine at commit time —
`commitAction` returns `ok: false` with stage `hook_blocked` (an
`onActionAttempted` block: Don't Move, Silence, Taunt) and **no state change**.
Since Session 31.5 the orchestrator surfaces this as a `rejection` on the step
rather than throwing (a throw used to crash the React tree).

The S63 Taunt audit (`docs/thirtyNinePlanning/taunt-audit.md`) surfaced a latent
hang in that flow. The basic-AI controller is a stateless
`decideBasicAi(state, catalog)` — pure and deterministic. When its chosen action
is rejected, the orchestrator makes no progress, so on the next pump tick the
controller is re-asked with the *identical* state and returns the *identical*
blocked action, which is rejected again — forever. A deterministic block (e.g.
Taunt's per-ability hash) on the AI's top-scored action would spin the pump
indefinitely and hang the battle.

Human controllers do **not** hit this: after a rejection the UI controller's
queued decision is drained and it returns `pending` until the player submits
something new, so there is always a `pending` step between two human
submissions.

## Decision

Add a **loop-breaking guard** to `DemoOrchestrator`, keyed on the difference
between human and AI control *without* the orchestrator needing to know which is
which:

- Track the last controller-submitted root action that was rejected, as
  `{ unitId, signature }` where `signature = unitId | JSON.stringify(action)`.
- On a rejection: if the same unit re-submits the byte-identical action that was
  just rejected (the recorded signature matches), force a `turn_end` for that
  unit to break the loop. The originating rejection is still surfaced on the step
  (so the pump logs *why* the turn was cut), alongside the forced `turn_end`'s
  commits.
- Otherwise, record the rejection and return it as before (first rejection still
  surfaces; no behavior change for a single block).
- Clear the record on any **progress**: a successful commit, a `pending` step
  (this is what exempts human retries — the `pending` between submissions resets
  the guard), and at each turn boundary.

A forced `turn_end` that itself fails to commit throws — `turn_end` must always
validate for the active unit, so a failure there is an engine bug, not a runtime
refusal, and should stay loud.

### Why a repeat-detection guard rather than an "AI-only" rule

The orchestrator holds a `ControllerMap` (team → Controller) and has no
human/AI flag. Detecting an immediate identical re-proposal is controller-
agnostic and naturally exempts humans (their `pending` step clears the guard),
so it needs no new plumbing and defends against *any* deterministic controller,
not just today's basic AI.

### Why `turn_end` rather than `wait` or re-planning

The unit has no action it both wants and is allowed to take this step (its top
choice is blocked and it will keep choosing it). Ending the turn is the minimal
correct recovery; it advances the battle and lets the unit try again next turn
(by which point state — and thus the AI's decision — may differ). Re-planning
with an exclusion set would require threading rejected-action memory into the
pure AI layer; out of scope for a safety net.

## Consequences

- No blocking hook — Taunt today, or any future `onActionAttempted` block — can
  hang a battle. The guard is a substrate safety net, independent of the Taunt
  redesign (deferred; see the audit).
- A Taunted AI unit whose best action stays blocked now **loses its turn** rather
  than hanging. That is a stopgap, not the intended Taunt design — the redesign
  will give the AI real taunt-awareness so it picks a *different* (allowed)
  action instead of burning the turn.
- Two orchestrator tests lock the behavior: a deterministic re-submission is
  force-ended; a `pending` step between submissions exempts the human-retry path.
- Pure-engine reducers are untouched; this lives entirely in the app-layer
  orchestration loop, consistent with the engine/renderer/app split.
