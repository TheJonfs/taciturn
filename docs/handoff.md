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

## From session 2026-05-03 (renderer skeleton + demo battle)

### Suggested next-session scope

Roadmap session 11: **UI skeleton.** React-side controls that drive the engine through the same `commitAction` path the demo orchestrator uses. Concrete deliverables per the roadmap:

- Action menu for the active player-controlled unit (Move / Attack / Wait). Click-to-select-target on the battle map.
- Current-unit panel (HP, MP, Speed, status icons placeholder).
- Projection-queue display: read `projectUpcoming` and show the next ~5 turns. KO filtering already in place (this session).
- Replace one team's controller in the demo with a click-driven UI controller; the other stays on `greedyMeleeController` until session 12 lands the AI.

The renderer should not need structural changes. The animator's `playActions` already accepts arbitrary committed-action sequences; the UI just needs to call `orchestrator.step()` indirectly via a "submit action" button rather than the auto-pump that `BattleView` does today.

### Things noticed during the renderer session

- **Renderer + orchestrator coupling is via `BattleView.tsx` only.** `src/renderer/` and `src/app/demo/` are independent — no cross-imports. The pump loop lives in BattleView's `useEffect`. When session 11 introduces a UI controller, it'll likely move the pump into a custom hook or app-level controller; the renderer/orchestrator boundaries don't need to shift.

- **Animator derives visual state from action outcomes, not from engine-state snapshots.** A `move` reads `outcome.pathTaken`; a `use_ability` reads `outcome.perTargetResults[0].damage` and applies the HP delta itself. This means the renderer never reads intermediate engine states (only the latest, kept on `lastState`). When the renderer needs information that isn't in the action outcome (e.g., "what's the unit's current MP?"), it should sync from `lastState`, not try to derive from the action chain.

- **`turn_start` always paints the active highlight; `turn_end` always clears it.** Skipped turns (Stop) still emit both, so the highlight blinks on and off correctly. The renderer doesn't special-case `outcome.skipped`.

- **Pump waits on `renderer.isIdle()` per Pixi tick.** This means the orchestrator commits one chain-root per "free" frame. Long chains (Counter on attack, etc.) come through as a batch and play sequentially. The pacing is currently ~220ms per move-step + ~360ms per attack flash + ~240ms turn boundaries; tunable in `src/renderer/constants.ts`.

- **BattleView handles React StrictMode double-mount correctly.** The cleanup function destroys the Pixi app and removes the canvas node; the `disposed` flag short-circuits the second async-init's late finish. Verified visually — no duplicate canvases, no stuck animations.

- **Demo orchestrator throws on unexpected commit failures.** Any `commitFailure` mid-loop (validation, hook_blocked) is a programmer error in the controller — the controller should never propose an invalid action. Surfacing the throw rather than swallowing keeps such bugs visible. The UI controller in session 11 should pre-validate its proposed actions to give the user feedback before commit (the engine will validate again on commit).

- **`projectUpcoming` now filters KO'd units.** Aligned with the scheduler. New regression test in `src/engine/ct/projection.test.ts`. The scheduler still has its own filter — both call sites remain correct independently.

### Things considered but did not do

- **Refactor projection.ts and scheduler.ts to share a snapshot helper.** Carried from session 9 handoff. Skipped — they're still independent, and the renderer didn't surface a shape that demanded a shared helper. Land if session 11 wants to project the queue alongside the scheduler in a shared shape (e.g., for a "show next 5 turns" UI panel).

- **`reaction_fizzled` system event.** Carried from session 9 handoff. Skipped — no v1 consumer in the renderer (only one Counter content piece, and silently dropping is fine for the demo). Lands when there's a UI panel surface to show "Counter fizzled — out of range."

- **Replay function from action log.** Carried. Still no consumer; renderer doesn't rewind. Defers to session 13's first playable battle if a "replay last battle" feature surfaces.

- **Damage-number popups, easing curves, sprite atlases, particle effects.** All polish. Out of scope for the MVP renderer. Lands as a polish pass after session 13.

- **Sprite per intermediate path tile.** The animator interpolates linearly along `pathTaken`, so a unit moving across multiple tiles slides through them rather than stepping discretely. v1 acceptable; the FFT-style "discrete step per tile" feel is a polish-pass concern.

- **Camera zoom / pan controls.** No user input; the camera lerps to the active unit only. UI session likely adds zoom + click-pan; not now.

- **Tile elevation rendered visually.** The single-layer demo map is flat — `tile.elevation` is 0 everywhere. The tile layer ignores elevation. Lands when multi-elevation map content does.

- **Unit class iconography on top of the team-color circle.** Visual identity for "this is a Knight" — out of scope; team color + position is enough for the demo.

- **Pre-validation in the greedy controller.** The controller already calls `validateAction` to check "is this attack legal?", but doesn't pre-check moves (it relies on `getLegalMoves`). Symmetric pre-validation across both action paths would be cleaner; left for session 11 when the UI controller has a stronger reason to introspect validation results.

- **Generalizing the orchestrator beyond two teams.** `ControllerMap` is a `ReadonlyMap<TeamId, Controller>` — N-team-friendly today. The throw on missing controller is the right behavior. No code change needed when 3+ teams arrive.

### Open questions for later sessions (not blocking)

- **Where does the UI controller live?** Session 11 territory. Likely `src/app/controllers/ui-controller.ts` — an object that exposes "dispatch an action" and "abort/retract" handles for click-driven input. The orchestrator doesn't change shape; it just delegates to a different controller.

- **Pause / step-by-step mode.** Useful for debugging the engine + renderer. The pump in BattleView could be gated behind a flag that requires manual frame-step. Not session-11-blocking; flag if the demo battle ever surfaces a bug that's hard to catch in real-time.

- **Catalog hot-reload during development.** Carried (architecture overview's open question). Vite's HMR is loud about React changes but engine-state hot-reload during a live battle would be nice for content authoring. Lands when content authoring becomes a daily pain point.

- **Turn-skipped status_tick fan-out (Stop).** Carried from session 9. Today skipped turns don't tick statuses on the unit. When Sleep + Poison-style content forces the distinction, refines.

- **Battle-end checkpoint on damage-application.** Carried from session 9. When a kill-the-leader victory condition ships, mid-resolution `evaluateBattleOutcome` lands.

- **Charged-action triggers in `advanceToNextEvent`.** Carried. Still no v1 consumer; `'charged_action_resolve'` branch of the scheduler awaits its first integration test alongside the first charged ability.

- **Per-status flag for "tick on skipped turn."** Carried. Lands with Sleep-like content.

- **Initial-CT formula tuning.** Carried. Default ruleset stays on `'fixed'`. The demo battle's two units start at CT 0 simultaneously; the lex-id tiebreak gives `blue_knight` the first turn deterministically. Session 13 may opt into the variance variant for feel.

- **Action-log compaction on long battles.** Still deferred; nothing surfaced this session.

- **Out-of-range counter / "Counter Magic at non-magical attack" gating semantics.** Still deferred; renderer doesn't surface friction.

- **Sandbox interaction with `vite dev`.** This session used `mcp__Claude_Preview` to start the dev server (sandboxed); direct `vite` invocation via Bash was denied. The launch config is checked in at `.claude/launch.json` for re-use.
