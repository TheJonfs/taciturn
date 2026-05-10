# Session 23 Brief: Battle UI — Interaction Layer

## Context

Session 22 converged the existing renderer/HUD scaffolding (live since Sessions 10-20) toward the design doc's 4-region shell, added the Camera controller and Training Field map, and parked the legacy interaction surface (`UiController`, `ActionMenu`, `useBattleUi`, `CurrentUnitPanel`, `TurnQueuePanel`) for refit-or-removal in this session. Both teams currently run on `BasicAiController`; there is no player interaction.

This session restores player interaction. Player drives `team_a` through a full battle end-to-end: pick an action, pick a target, commit, watch animation, repeat. Action log streams alongside. ESC pauses. By session end, the playable demo loop works — minus forecast/projection polish (Session 24) and the title screen entry path (Session 34).

This is also the third-controller trigger for `canCommitAction`. The duplication across `src/ai/basic.ts` and `src/app/demo/controller.ts` (intentional small duplication per ADR-0035) gets promoted to a shared utility now that the UI controller comes back online as the third commit-emitter.

The brief assumes the planner does not have full visibility into the existing tree. The Pre-implementation plan section requires a current-tree audit as the first task. Outcomes are framed as deliverables, not from-scratch builds — refit, replace, or remove are all valid paths to the outcome depending on what the audit reveals.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions, module-boundary discipline, ADR practice.
2. **`docs/handoff.md`** — Session 22 handoff. Note especially: parked-files inventory, settings-placeholder provisional status, `canCommitAction` promotion trigger.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 23 entry; Session 24 entry for context on what's deferred (forecast/projection column, status detail popovers).
4. **`docs/twentyOneDesign/battle-ui-architecture.md`** — primary design doc. Sections relevant this session: turn-flow state machine, action menu, targeting / AoE preview, action log panel, pause overlay / ESC menu.
5. **`docs/audits/post-20-engine-audit.md`** — Item 20 confirms action-log shape is sufficient for streaming display. Item 19 confirms forecast contract sufficient for Session 24's polish (not in scope this session).
6. **`docs/adr/ADR-0035-controller-pre-flight.md`** — captures `canCommitAction` duplication rationale and the "third controller" promotion trigger.

### Paths to survey before planning

The Pre-implementation plan must include a current-tree audit. At minimum, survey:

- `src/ui/` — particularly `battle-hud.tsx`, `queue-tower.tsx`, the four parked files (`action-menu.tsx`, `use-battle-ui.ts`, `current-unit-panel.tsx`, `turn-queue-panel.tsx`), and `index.ts` exports.
- `src/app/controllers/` — `ui-controller.ts` and its test, `basic-ai-controller.ts`.
- `src/app/BattleView.tsx` — current orchestrator wiring, controller assignments, input dispatch.
- `src/renderer/` — `highlight-layer.ts`, `battle-renderer.ts`, the camera controller (`camera-controller.ts` from Session 22), `animator.ts` if it exists.
- `src/ai/basic.ts` (`canCommitAction` duplicate site).
- `src/app/demo/controller.ts` (the other `canCommitAction` duplicate site; possibly the wider-scope greedy controller).
- `src/engine/actions/` — to identify the right home for promoted `canCommitAction`.
- `src/engine/actions/validate.ts` and the hook runner module — to confirm the existing `runOnActionAttempted` purity properties relied on by the pre-flight check.

The plan articulates what already exists, what's being refit, what's being added, what's being removed.

## Goal

Player can play a full battle on Training Field as `team_a` against AI `team_b`:

- Pick an ability for the active unit from a visible action menu
- Pick a target / target tile, with legal targets highlighted
- Commit; the orchestrator processes the action and animator plays the result
- Action log streams a human-readable record on the right side
- ESC opens a pause overlay; pause overlay routes to settings (immediately) and quit (deferred to Session 34's title screen)

Tests at 583+ passing, 0 failing. New behaviors covered where pure logic is testable.

## Pre-implementation plan (required)

Before code, plaintext plan covering:

### Required first step: current-tree audit

Articulate, for each surface this session touches:
- What already exists (component, controller, layer, helper)
- What state it's in (live, parked, partial, broken)
- What this session does to it (refit, replace, remove, leave alone)

This is not optional. The audit's accuracy determines whether the rest of the plan is reasonable.

### Architectural decisions

After the audit, the plan addresses:

1. **Turn-flow state machine.** Explicit type / enum for the states (idle → action menu → target selection → commit → animation → idle, plus pause-overlay-open as a parallel state). Transitions deterministic. State lives in React or in a non-React module the controller calls into — make the choice and justify.

2. **`canCommitAction` promotion target location.** Suggested: `src/engine/actions/can-commit.ts`. Confirm or propose alternative based on tree shape. The promoted helper takes the same arguments the duplicates take; controllers import from one site; existing tests for `validateAction` + `runOnActionAttempted` cover the semantics.

3. **Action menu shape against the 4-region shell.** Lives in the bottom region per the design doc. How abilities are organized (by command set, then within set), how disabled abilities communicate their disable reason (tooltip on hover, inline text, both), how MP cost and charge time are visible. Keyboard-and-mouse parity expected; specifics in the plan.

4. **Targeting overlay and AoE preview.** Extends or replaces the existing `HighlightLayer`. Visual distinction between (a) tiles in range / units that could be targeted, (b) the currently-hovered target, (c) the AoE footprint when an AoE ability is being aimed. State the data flow — the renderer reads ability targeting metadata from where, and computes the legal-target set how.

5. **Action log streaming display.** Lives in the right region per the design doc. Format-per-entry: human-readable summary (actor, verb, target, magnitude where applicable; KOs prominent). Auto-scroll on new entry. No filtering / search / pagination v1. State the formatter pattern — a per-action-type render function, a single switch, a small visitor — and where it lives.

6. **Pause overlay / ESC menu.** Modal over the whole UI. v1 contents: Resume, Settings (nested or inline), Quit (deferred — stub button or hidden). Pauses the orchestrator pump while open. Pause overlay also is the new home for what's currently in the unused settings placeholder slot in `BattleHud` — that placeholder gets removed.

7. **Parked-file disposition.** Per the audit's findings: which of the four parked files (`action-menu.tsx`, `use-battle-ui.ts`, `current-unit-panel.tsx`, `turn-queue-panel.tsx`) are refit, which are replaced, which are deleted. The session ends with no orphan exports in `src/ui/index.ts` and no dead files in `src/ui/`. State the disposition and reasoning per file.

8. **`UiController` reconnection and refit.** The controller is currently parked. State what it needs to do against the new shell — likely: receive turn-start, expose a "produce a commit" interface to the turn-flow state machine, integrate with the action menu and targeting overlay. State whether the existing controller is refit or rewritten; state any contract changes.

9. **Pause-overlay scope: now vs Session 34.** Quit-to-title is deferred to Session 34 when the title screen exists. Session 23 delivers a Quit button that's either disabled, hidden, or stubs to a placeholder. State the choice. Settings inside the overlay is in-scope this session — what controls? My read of the design doc says volume, animation speed, log verbosity, accessibility toggles. Confirm against the doc; settle the v1 set.

10. **Test strategy.** Pure logic (state-machine transitions, formatter functions, target-legality computations) gets unit tests. Component / interaction behavior relies on manual verification with light snapshot coverage where useful. Don't aim for engine-grade coverage. State which pieces are pure-and-tested vs. visual-and-manual.

11. **Possible 23a / 23b split.** Session 22's brief allowed a split if scope ballooned. Same allowance applies here. Suggested split lines if needed:
    - **23a:** turn-flow state machine + action menu + targeting overlay + commit handler + UiController reconnection + `canCommitAction` promotion + parked-file disposition (the core interaction).
    - **23b:** action log streaming display + ESC pause overlay + settings placeholder removal (the polish + edge cases).
    
    If the audit suggests a different split makes more sense (e.g., splitting on canCommitAction promotion + parked-file disposition as 23a, and the rest as 23b), propose it. The split itself should be in the plaintext plan, not discovered mid-implementation.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, work lands roughly in plan order. Items below are outcomes; the plan determines how each is achieved.

### Item 1: `canCommitAction` promotion

Promote the duplicated helper from `src/ai/basic.ts` and `src/app/demo/controller.ts` to a shared module (likely `src/engine/actions/can-commit.ts`). Existing two callers updated to import from the shared site; UI controller becomes the third caller. Behavior unchanged; ADR-0035's "controllers, plural" rule is now mechanically enforced by single source.

### Item 2: UiController reconnection and refit

The parked `UiController` comes back online for `team_a` (per the v1 demo's controller assignments). Its interface aligns with the turn-flow state machine — it produces a commit when the player has picked an action and target, signals "waiting on player input" otherwise. Refit or rewrite per the plan's call.

### Item 3: Turn-flow state machine

Explicit state machine drives the player's turn experience:
- `idle` — waiting for active unit's controller (AI or UI)
- `action_menu` — UI controller's turn, action menu visible
- `target_selection` — action picked, picking a target
- `commit` — validated; sending to orchestrator; brief
- `animation` — orchestrator processing, animator playing
- `paused` — orthogonal state for pause overlay (overlays any other state)

Transitions are deterministic. Cancellation paths exist (back from target selection to action menu via ESC or right-click, etc.).

### Item 4: Action menu

Bottom region of the 4-region shell. Lists available abilities for the active unit, organized by command set. MP cost and charge time visible per ability. Disabled abilities greyed with disable reason accessible (tooltip / inline). Keyboard-navigable; click-to-pick.

### Item 5: Targeting overlay and AoE preview

Highlights legal targets when an action is being aimed. AoE preview shows the affected footprint when hovering a target tile for an AoE ability. Single-target, AoE (cross / diamond / cone / line shapes), self-target all supported. Visual idiom distinguishes "could target this" from "currently hovering this" from "AoE will hit these."

### Item 6: Commit handler

Bridges UI to orchestrator. Player's choices build a `proposed_action`; passes through `canCommitAction` (via the promoted shared utility); calls `commitAction` if valid; surfaces error / disabled state if not. Integrates with the turn-flow state machine's `commit` → `animation` → `idle` transitions.

### Item 7: Action log streaming display

Right region. Human-readable streaming list: each resolved action becomes a row. Format-per-entry handles damage, status apply/remove, KO, action effects (move, attack, ability cast, etc.). Auto-scroll on new entry. No interactive filtering / search v1.

### Item 8: ESC pause overlay

Modal over the whole UI. Triggered by ESC. Pauses orchestrator pump while open. Contents:
- **Resume** — closes the overlay, resumes pump.
- **Settings** — animation speed, log verbosity, accessibility toggles per the design doc. Lives within the overlay (or as a nested overlay if cleaner).
- **Quit** — stub or hidden v1; wired to title-screen navigation in Session 34.

ESC-to-back-out from target selection routes to action menu, *not* to pause. ESC at idle opens pause.

### Item 9: Settings placeholder removal

The bottom-right placeholder added in Session 22 to satisfy the original brief's literal text comes out. Settings now lives in the pause overlay per the design doc.

### Item 10: Parked-file cleanup

`action-menu.tsx`, `use-battle-ui.ts`, `current-unit-panel.tsx`, `turn-queue-panel.tsx` are refit, replaced, or deleted per the plan's disposition. `src/ui/index.ts` exports cleaned. No dead files remain.

## Acceptance criteria

- A player can play `team_a` through a full battle on Training Field, end-to-end.
- Action menu shows abilities; MP costs / charge times visible; disabled abilities communicate why.
- Targeting works for all currently-content's ability shapes (single, cross, diamond, cone, line, self).
- AoE preview shows on hover during target selection.
- Commit triggers animation; UI returns to idle.
- Action log streams readable entries on the right.
- ESC pauses; pause overlay's Resume / Settings work; Quit is appropriately stubbed.
- Settings (animation speed, log verbosity, accessibility) function from the pause overlay.
- `canCommitAction` is in a shared module; all three controllers (UI, basic AI, greedy) import from it; no duplicate definitions remain.
- All Session 22 parked files refit, replaced, or removed; `src/ui/index.ts` has no orphan exports.
- Tests: 583+ passing, 0 failing. New pure-logic surfaces (state-machine, formatters, target-legality) covered.
- ADRs written for: turn-flow state machine architecture, `canCommitAction` promotion, pause overlay scope (Session 23 vs Session 34 split).

## Out of scope

- **Forecast / projection column.** Session 24. The targeting overlay shows AoE footprint; it does not show damage forecast numbers, hit chance, or status application chance.
- **Status detail popovers.** Click/hover on a status badge to see details — Session 24 polish.
- **QueueTower's full 20-event horizon and scrolling.** Session 24. v1's 7-event horizon stays.
- **Title screen.** Session 34.
- **Quit-to-title.** Session 34. v1 Quit button is stubbed/hidden/disabled.
- **Replay scrubbing.** Phase F.
- **Save / load.** Phase F.
- **Real art / sound.** Post-MVP.
- **Animation polish beyond what already exists.** The animator does move-tween, hit-flash, KO transition, turn pauses (per Session 22's handoff). Adding new animations is not in scope; the existing animations stay.
- **MP / status snapshot ahead-of-tween fix** — known limitation from Session 22 handoff. Acceptable for MVP; address when animation polish lands later.

## Files likely touched

A non-exhaustive list anchored to current-tree assumptions; the audit confirms / corrects:

- `src/engine/actions/can-commit.ts` — new (or alternate location per plan)
- `src/ai/basic.ts` — refactored to import shared `canCommitAction`
- `src/app/demo/controller.ts` — refactored similarly
- `src/app/controllers/ui-controller.ts` — reconnected, possibly refit
- `src/app/BattleView.tsx` — UiController for `team_a`, ESC handler, pause integration
- `src/ui/battle-hud.tsx` — settings placeholder removed; action menu and log slots wired
- `src/ui/action-menu.tsx` — refit, replaced, or deleted per plan
- `src/ui/use-battle-ui.ts` — refit, replaced, or deleted per plan
- `src/ui/current-unit-panel.tsx` — likely deleted (content migrated to QueueTower)
- `src/ui/turn-queue-panel.tsx` — likely deleted (content migrated to QueueTower)
- `src/ui/action-log-panel.tsx` — new
- `src/ui/pause-overlay.tsx` — new
- `src/ui/turn-flow.ts` — new (or in another module per plan)
- `src/ui/index.ts` — exports cleaned
- `src/renderer/highlight-layer.ts` — extended for target highlights and AoE preview, or replaced
- New tests for state machine, formatters, target legality, pause-state interactions.
- New ADRs in `docs/adr/`:
  - `ADR-XXXX-turn-flow-state-machine.md`
  - `ADR-XXXX-can-commit-action-promotion.md`
  - `ADR-XXXX-pause-overlay-scope.md` (or fold into turn-flow if overlapping)
- `docs/handoff.md` — updated.

## Workflow notes

- **Plaintext-first review required.** Same discipline as Session 22. Plan reviewed before code.
- **Audit-first within the plan.** Current-tree audit is the first deliverable inside the plan, not an afterthought. The brief's framing of items as outcomes only works if the audit grounds them.
- **Session 23 size.** This is the largest interaction-layer session in the arc. If the plan reveals a split is needed (suggested 23a/23b lines in section 11 of the plan), propose it before starting implementation.
- **Mid-session design questions** route via the conduit. The planner's instance is available for design questions that surface mid-implementation; don't make unilateral architectural calls under uncertainty. Send the question via `handoff.md` partial-update or directly via the conduit.
- **The integration test calibrated to `demoBattle`'s 6×6 board** (per Session 22's handoff) stays calibrated to it; nothing in this session should perturb the AI-vs-greedy win-rate balance there. The playable runtime continues to use `trainingFieldBattle`.

## Watch-fors carried forward

Items from prior handoffs that this session may or may not touch:

**Addressed this session:**
- `canCommitAction` promotion (Session 21 carry-forward — fired this session as third-controller trigger)
- Parked file disposition (Session 22 carry-forward)
- Settings placeholder removal (Session 22 carry-forward — replaced by pause overlay)

**Not addressed this session, carried forward:**
- Top bar Turn # is O(n) on `actionLog` (Session 22). Not regressed; defer to whenever `actionLog` performance becomes visible.
- Renderer's MP "max" captured at mount (Session 22). Replaces with `maxMp` lookup once Session 28 (Cluster 4) ships.
- Status-badge polarity convention: `tags`-based vs `polarity?` field (Session 22). No urgency; revisit at next status-system touch.
- QueueTower 7-event vs 20-event horizon (Session 22). Pinned to Session 24 (forecast/projection polish session).
- `docs/content-snapshot.md` drift (Session 21 carry-forward). Refresh scheduled for Session 26.
- `src/ai/projection.ts:142` defensive clamp (Session 21 carry-forward). Schedule with next AI-projection touch — could be a small Session 24 item if forecast/projection work touches that file.
- Resistance composition cap at 100 (audit E2). Session 27.
- `pa_factor NotYetImplementedError` (audit E3). No content asks; defer.
- `equipmentContributionsFor` "branch per hook" (audit E4). Session 27.
- TS strict-mode test errors (audit E8). Not blocking.

## Estimated size

Large. The plaintext plan with current-tree audit is real work. The implementation has 10 items spanning state-machine architecture, controller refit, two new major UI surfaces (action log panel, pause overlay), targeting/AoE visualization, and a meaningful refactor (`canCommitAction` promotion). If the plan's audit reveals more refit work in the parked files than expected, the 23a/23b split is the right move. Suggested split lines are in plan section 11; the audit may suggest different ones.
