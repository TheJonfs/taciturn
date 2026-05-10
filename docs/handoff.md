# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-10 (Session 21 — Cluster 1 stabilization)

Closed the post-reconciliation stabilization gap. Both audit-flagged engine items landed, plus one mid-session expansion to keep the test acceptance bar.

**Landed:**

1. **E1 crit_chance clamp.** `critRoll` ([`src/engine/damage/handlers.ts:376`](../src/engine/damage/handlers.ts:376)) now clamps the queried `crit_chance` to `[0, 100]` at the read site. Stacking 6× Crit_modifier on a v1-baseline unit (5 + 120 = 125) caps cleanly at 100% crit. Tests in [`src/engine/actions/session-20-integration.test.ts`](../src/engine/actions/session-20-integration.test.ts) cover both bounds. ADR-0034.

2. **E9 controller pre-filter.** Added `canCommitAction` helper in both [`src/ai/basic.ts`](../src/ai/basic.ts) and [`src/app/demo/controller.ts`](../src/app/demo/controller.ts) that runs `validateAction` AND `runOnActionAttempted` before returning a commit decision. Six controller-side commit sites updated (4 AI, 2 greedy). ADR-0035 captures the rule as "controllers, plural" rather than just the AI.

3. **Test acceptance criterion met.** `npm test`: **559 passing, 0 failing across 46 files** (was 555/557 with 2 reds at session start).

### Mid-session scope expansion (worth flagging)

The brief and audit named only `src/ai/basic.ts` for the E9 fix and predicted "the two failing tests should pass after this change with no further intervention." That prediction was wrong: the failing iteration (`seed=0x1, aiTeam=team_b`) put the broken move proposal on the *greedy placeholder controller*, not the AI. Greedy had the structurally identical bug — `pickStepToward` returns a destination from `getLegalMoves` (pure pathfinding) and the move proposal was committed without `runOnActionAttempted` ever running. Audit miss, not a true scope change. Confirmed with Chris mid-session before extending the fix to greedy.

**Implication for the audit's reliability:** the audit covers each subsystem item and is solid on the engine surface, but the controller layer (`src/app/demo/controller.ts` is the only non-AI, non-UI controller today) was not in its scope. If the audit produces follow-on session briefs, double-check whether the brief's "what fix lands the test" prediction holds end-to-end before assuming it's complete.

### The next session is Session 22 — Battle UI: visualization layer

Per [`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`](twentyOnePlanning/roadmap-sessions-21-plus.md), Session 22 starts the Phase A battle UI work:

- Goal: render the map and units on a PixiJS canvas wrapped in React. Camera controls (pan, zoom). Static visualization — no interaction yet.
- Engine work: none.
- Content: Training Field map (14×14, uniform terrain at elevation 2). Hard-coded starting positions in `demo.ts`.
- UI: React + PixiJS scaffolding under `src/ui/`; map renderer; unit renderer; camera controls; settings panel scaffold.
- The audit confirmed no engine gaps for visualization (Items 19 and 20 in the audit explicitly: "no engine gaps that block the UI session").
- **Deferred wiring:** `BattleConfig` is loaded statically by `loadDemoBattle()`; the loader is replaced by team-builder output in Sessions 36-37. Keep the loader interface stable.

Read order for Session 22:

1. `docs/twentyOnePlanning/roadmap-sessions-21-plus.md` — Session 22 entry.
2. `docs/twentyOneDesign/battle-ui-architecture.md` — primary design doc for this session.
3. `docs/audits/post-20-engine-audit.md` — Items 19-20 (UI prerequisites notes); Section E for general engine state.
4. `CLAUDE.md` — the React/PixiJS module-boundary rules; the engine-knows-nothing-about-rendering ground rule.

### Watch-for / open items, in priority order

- **`runOnActionAttempted`'s purity is now load-bearing for controller correctness.** The hook runner currently passes no state to handlers and they return `ActionAttemptResult` only — they cannot mutate state by construction. If a future hook signature change adds state-mutating capability to `onActionAttempted` (e.g., a "log this attempt" hook), the controller pre-filter pattern double-fires the side effect. ADR-0035 documents this; the next session that touches `src/engine/hooks/runners.ts` should be aware. Worth a comment on the runner. Not done in this session because the comment would orphan if a future hook never lands.

- **`canCommitAction` is duplicated across `src/ai/basic.ts` and `src/app/demo/controller.ts`.** Intentional small duplication (different module tiers; helper too small to over-couple). If a third controller appears (likely the UI controller in Sessions 22-23), promote to a shared utility — likely `src/engine/actions/can-commit.ts`. Watch for this when wiring the UI controller in Session 23.

- **`docs/content-snapshot.md` is still drifted from source-of-truth** (carry-forward from prior session). The audit-session content reconciliation updated 19 content files; the snapshot still shows pre-reconciliation values. Per the prior-session reasoning, refresh after the first content session of wave 3 (Session 26 — movement abilities authoring) lands so the refresh captures both the calibration shift and any new content together. Still not refreshed in this session; not regressed either.

- **`src/ai/projection.ts:142` retains its own `Math.max(0, Math.min(1, crit_chance / 100))` clamp.** This is now defensive duplication — `critRoll` clamps the upstream query. Recommended cleanup: drop the projection-side clamp. Not done in Session 21 because the projection layer's contract test (`src/ai/projection.test.ts`) covers the composed behavior; touching the clamp without re-validating the contract test is a lateral change, not a stabilization fix. Schedule with the next AI-projection touch.

- **Resistance composition cap at 100 (audit E2)** — unchanged from prior handoff. Re-check when Cluster 3 (Session 27) lands `modifyResistance`.

- **`pa_factor` `NotYetImplementedError` (audit E3)** — unchanged. No content asks for it.

- **`equipmentContributionsFor` "branch per hook" (audit E4)** — unchanged. Cluster 3 (Session 27) is the natural place to refactor; recommend doing it before the contributor accumulates >5 branches.

- **TS strict-mode test errors (audit E8)** — unchanged. Not blocking. Drop until someone wants a focused cleanup session.

### Considered and rejected this session

- **Orchestrator-side fallback to Wait on commit failure.** Considered as an alternative E9 fix. Rejected: papers over the bug; controller's scored action diverges silently from the orchestrator's commit. Captured in ADR-0035.

- **Folding `runOnActionAttempted` into `validateAction`.** Considered as a way to make the pre-filter automatic for all callers. Rejected: changes `validateAction`'s pure-function contract and surprises every existing call site. The controller-side explicit pre-flight is cleaner and keeps validation pure. Captured in ADR-0035.

- **Factoring a "pure-mode" runner out of `runOnActionAttempted`** (suggested by the brief). Rejected as unnecessary: the existing runner is already pure (handlers receive no state and return `ActionAttemptResult` only). No factor-out needed.

- **Removing the `src/ai/projection.ts:142` clamp inline** while touching crit. Considered (it's now defensive duplication). Rejected: the projection layer has its own contract tests; removing the clamp is a separate cleanup that should land with a re-validation pass. Logged in watch-for above.

### Items dropped from prior handoff

- **"AI integration test is red"** — superseded; landed in this session.

- **"`crit_chance` is not engine-clamped"** — superseded; landed in this session.

- **"Two failing tests in `ai-controller.integration.test.ts`"** — superseded; both green.
