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

---

## From session 2026-05-03 (UI skeleton)

### Suggested next-session scope

Roadmap session 12: **AI.** Drop-in replacement for `greedyMeleeController` that produces non-trivial decisions. The orchestrator's `Controller` interface (now `ControllerDecision`) is the single integration point — the AI doesn't need to know about React, the renderer, the pump, or the UI controller. It just reads `(state, catalog)` and returns one of `commit | end-turn | pending`.

For the demo, `team_b` would switch from greedy to the new AI; `team_a` stays on the UI controller from session 11. The AI never returns `pending` (it always has an answer), so it composes with the existing pump unchanged.

Suggested concrete deliverables:
- `src/ai/` populates with a `createBasicAi()` factory and a heuristic decision routine: target selection (lowest-HP enemy in range; ties broken by lex-id), action selection (attack if in range; otherwise move toward target; otherwise end turn).
- Integration test that pits greedy vs basic-AI in the demo battle and verifies the basic-AI wins or draws across multiple seeds (or at minimum, terminates).
- BattleView wires `team_b` to the new AI controller.

### Things noticed during the UI session

- **Headless preview tabs throttle `requestAnimationFrame`.** When verifying via `mcp__Claude_Preview`, the preview window is hidden, which pauses Pixi's ticker — the pump never fires. Manual ticking via `app.ticker.update(performance.now())` from a debug global was needed to drive the engine for verification. The production code path is correct (it works in a foreground browser tab; verified end-to-end with synthetic Pixi `pointertap` events to commit a move and an attack). For future sessions: if the preview demo "looks frozen," check `document.hidden` first.

- **`ControllerDecision` wraps the commit case explicitly.** `{ kind: 'commit'; action: ProposedAction }` rather than a flat `ProposedAction` variant in the union. The wrapper costs six characters per call site and gains unambiguous TypeScript narrowing. ADR-0012 captures the rationale.

- **UI controller is single-slot.** `submit`/`endTurn` throw if a decision is already queued. The hook (`useBattleUi`) checks `hasPending()` before calling, so the throw path doesn't trigger under normal use; it surfaces actual bugs (pump skipped, multiple submitters, etc.).

- **Click outside the highlight set cancels back to idle.** A click on a non-legal tile during `picking-move` / `picking-attack` resets to `idle` rather than no-op. This felt right ("changed my mind") but is a UX-policy choice; if the next session wants distinct cancel-vs-misclick behavior, the hook is where to put it.

- **The highlight layer sits between tiles and units.** Highlights show through nothing and show under unit sprites. Worked correctly out of the gate; flagging here so the next session knows the z-order is `tiles → highlights → units` if more layers are added.

- **Hit-testing picks the topmost layer.** `BattleRenderer.onPointerTap` resolves a click to (x, y) and then iterates `tilesAt` for the highest-layer tile. v1 demo is single-layer so this is a no-op pass-through. When multi-layer maps land, this is where layer disambiguation logic happens.

- **Static React style warning was about mixing `border` shorthand and `borderColor` longhand.** Caused by combining a base style with `border: '1px solid'` and an active-state override with `borderColor: '...'`. Fixed by switching all panel/button styles to longhand (`borderWidth` / `borderStyle` / `borderColor`). New styles authored after this session should follow the same pattern.

- **`reduceTurnEnd` line 473 ("nothing consumed → equivalent to wait").** The UI's "Wait" button calls `uiController.endTurn()` directly instead of submitting a `wait` action followed by `turn_end`. Same CT cost outcome. If a later content pass introduces statuses that hook differently on `wait` vs. budget-exhaust-to-turn-end (none today), the UI button needs to commit `wait` first.

### Things considered but did not do

- **Move the `Controller` type out of `src/app/demo/orchestrator.ts`.** It's increasingly less "demo-specific" and more "the orchestrator's interface." Skipped — three import sites, two of which are inside `src/app/`, and renaming `src/app/demo/` to `src/app/orchestrator/` is a tidier-than-needed reorg. Lands when the demo orchestrator generalizes (multi-battle support, save/load, etc.).

- **An `EndTurn` button distinct from Wait.** Today "Wait" is the only end-turn affordance and zeros the budget on commit. A separate "End Turn" might be useful when budget is mid-consumed (movesAvailable=0, actsAvailable=0 after Move + Attack). Today the UI auto-doesn't-show one; the player implicitly ends turn by clicking Wait. v1 acceptable; lands when the FFT-style facing-confirmation step lands.

- **Wait button commits a `wait` action then `turn_end`.** Per ADR-0009 / the design doc, `wait` zeros the budget and `turn_end` applies CT cost. Calling them in sequence is the spec-faithful path. Skipped because `reduceTurnEnd` already maps "nothing consumed" to wait-cost — same effective outcome with one fewer action in the log. Lands if a status hooks `wait` distinctly from "no budget consumed."

- **Pre-validation feedback in the Action Menu.** Today the buttons disable on budget exhaustion but don't disable when there are zero legal targets (e.g., Move when surrounded by walls, Attack when no enemies in range). The hook computes legal targets eagerly; the menu could read `legalMoveDestinations.length === 0` to grey the button. Skipped — minor polish; the user gets feedback by clicking and seeing no highlights. Lands during a UX pass.

- **Tooltip / hover preview on tiles.** The hook has a clean `setOnTileClick` integration point; a parallel `setOnTileHover` would let the UI surface "this would do 12 damage" or "this is in your move range from here." Skipped — out of scope for the MVP UI. The renderer API is shaped to allow the addition without restructuring.

- **Multi-action queueing on the UiController.** Single-slot with throw-on-double-submit is enough for v1's "click → wait for commit → click again" rhythm. A queue would let the player pre-input ("Move then Attack as one gesture"). Skipped — out of scope; would obscure the natural decide/observe rhythm. Lands when a real workflow demands it.

- **Replace the inline-style HUD with CSS modules / styled components / Tailwind.** The HUD components use inline-style objects throughout. Works fine for the MVP but doesn't scale to themed-component breadth. Skipped — content scope first; styling tooling is a future workstream once the visual identity stabilizes.

- **Test coverage on the React HUD.** Per the constitution ("UI/renderer tests are deferred to specific component decisions"), no new tests were added for the HUD components or the `useBattleUi` hook. The `createUiController` adapter has unit tests because it's pure logic with no React surface.

- **Focus management / keyboard input.** Tab to next button, Enter to confirm, Escape to cancel — unimplemented. Action menu is mouse-only. Lands during an accessibility pass.

- **Multi-team controller wiring (>2 teams).** `ControllerMap` is N-team-friendly; the demo just registers two. No code change needed when 3+ teams arrive — each team's `TeamId → Controller` entry routes to its own UI / AI / network handler.

### Open questions for later sessions (not blocking)

- **AI sees the same engine surface the UI sees.** Session 12's basic AI reads `(state, catalog)` and returns a `ControllerDecision`. It doesn't need access to the renderer, BattleView, or React state. The split is clean — flagging here so the next session doesn't accidentally reach across boundaries.

- **Where does charge-action UI live?** When session 12 or later content adds a charged ability, the UI needs to surface "this ability charges for N ticks; queue it?" The Action Menu already has the bones (read `ability.chargeTicks`). The TurnQueuePanel already projects charged actions (verified — the `'charged: AbilityName'` row works). Visual treatment of an in-progress charge on the actor is not designed yet.

- **Battle log / damage popups.** Today damage is observable via HP-bar movement on unit sprites + the per-action-flash. A textual log of "Blue Knight attacked Red Knight for 21 damage" could live in the HUD. Lands when content demands it (multi-target abilities especially benefit from a log).

- **Pause / step-by-step debug mode.** Carried from session 10. The pump in BattleView could be gated behind a flag that requires manual frame-step. Useful for debugging the engine + renderer + AI together. Lands when a hard-to-catch real-time bug surfaces.

- **Catalog hot-reload during development.** Carried. Vite's HMR works for component source but engine-state hot-reload during a live battle would be nice for content authoring. Lands when content authoring becomes a daily pain point.

- **Turn-skipped status_tick fan-out (Stop).** Carried. Today skipped turns don't tick statuses on the unit. When Sleep + Poison-style content forces the distinction, refines.

- **Battle-end checkpoint on damage-application.** Carried. When a kill-the-leader victory condition ships, mid-resolution `evaluateBattleOutcome` lands.

- **Charged-action triggers in `advanceToNextEvent`.** Carried. Still no v1 consumer; `'charged_action_resolve'` branch of the scheduler awaits its first integration test alongside the first charged ability.

- **Per-status flag for "tick on skipped turn."** Carried. Lands with Sleep-like content.

- **Initial-CT formula tuning.** Carried. Default ruleset stays on `'fixed'`. Session 13 may opt into the variance variant for feel.

- **Action-log compaction on long battles.** Carried; nothing surfaced this session.

- **Out-of-range counter / "Counter Magic at non-magical attack" gating semantics.** Carried; renderer doesn't surface friction.

- **`reaction_fizzled` system event.** Carried from session 9. No UI consumer yet — but now that the HUD exists, a "Counter fizzled" log line in the (future) battle log is the natural surface.

- **Refactor projection.ts and scheduler.ts to share a snapshot helper.** Carried from session 9/10. The TurnQueuePanel's projection display worked without forcing the issue; lands if a future shared shape demands it.
