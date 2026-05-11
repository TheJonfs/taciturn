# Session 24 Brief: Battle UI — Forecast, Projection Column, Results, MVP Completion

## Context

Session 23 landed the interaction layer: turn-flow state machine (ADR-0040), action menu rewrite, action-log streaming display, ESC pause overlay (ADR-0041), `canCommitAction` promoted to shared engine helper (ADR-0039). 622/0 across 52 files. Browser preview verified end-to-end interaction. `team_a` is player-driven; `team_b` is basic AI.

This session completes the battle UI MVP. By session end, a player can play a battle on Training Field, see what an action will do before committing (forecast hover), see what's coming several turns out (projection column), see the battle end with a results screen showing the winner and KO timeline, and reflect on what happened via click-to-expand action log entries with hover-counterpart highlighting on the canvas. Several Session 22-23 deferrals fold in: KO annotations in the action log, Status button activation, CT cost preview in the action menu, QueueTower's full 20-event horizon. The `projection.ts:142` defensive clamp cleanup (carry-forward from Session 21) lands here since forecast work touches the projection layer definitionally.

**This is the last brief before the MVP empirical check-in.** Per the workflow agreement, Chris plays the build at the end of this session, brings back feedback, and Phase B planning adjusts based on what playtest reveals. The framing of "done" for this session is **"MVP-playable-and-evaluable,"** not "all polish complete forever." Polish items that don't block evaluation belong in Phase F or whatever empirical feedback prioritizes.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions, module-boundary discipline, ADR practice.
2. **`docs/handoff.md`** — Session 23 handoff. Note especially: KO annotation requires running-HP tracking, Status button currently disabled, `projection.ts:142` clamp cleanup scheduled here.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 24 entry; Phase B preview for context on what's downstream.
4. **`docs/twentyOneDesign/battle-ui-architecture.md`** — primary design doc. Sections especially relevant: forecast pipeline, projection column, action log polish (click-to-expand, hover-counterpart), unit detail / status panel, results screen.
5. **`docs/audits/post-20-engine-audit.md`** — Item 19 confirms the forecast contract is sufficient; this session wires it. Item 20 confirms action-log shape is rich enough for KO synthesis and click-to-expand detail.
6. **`docs/adr/ADR-0034-crit-chance-clamp.md`** and **`docs/adr/ADR-0040-turn-flow-state-machine.md`** — context for the `projection.ts:142` cleanup and the turn-flow integration points the new UI surfaces will hook into.

### Paths to survey before planning

The Pre-implementation plan must include a current-tree audit. At minimum, survey:

- `src/ui/` — `turn-flow.ts`, `use-turn-flow.ts`, `action-menu.tsx`, `action-log-format.ts`, `action-log-panel.tsx`, `queue-tower.tsx`, `battle-hud.tsx`, `pause-overlay.tsx`, `settings-context.tsx`, `index.ts`.
- `src/renderer/` — `highlight-layer.ts` (two-channel from Session 23), `battle-renderer.ts`, `unit-layer.ts`, `tile-layer.ts`, `animator.ts` if it exists.
- `src/engine/projection/` (or wherever projection lives) — existing `projectUpcoming` and adjacent queries.
- `src/ai/projection.ts` — for the :142 clamp cleanup and to understand current projection consumers.
- `src/ai/basic.ts` — uses projection; informs what hooks are stable.
- `src/app/BattleView.tsx` — current pump, controller wiring, ResizeObserver, debug surface.
- `src/engine/state.ts` — to confirm `battle_end` action shape and victory-condition triggers.

The plan articulates what already exists, what's being refit, what's being added, what's being removed.

## Goal

Player completes a full battle on Training Field with full MVP polish:

- Forecast hover during target selection shows damage range, hit chance, status application probabilities, and AoE per-target preview.
- Projection column shows in-flight charged actions, reaction queue, and CT-ordered turn forecast beyond the QueueTower's view.
- Action menu shows CT cost alongside MP cost.
- QueueTower shows full 20-event horizon with scrolling.
- Action log entries are click-to-expand for full detail and hover-counterpart highlights the actor/target on the canvas.
- KO events synthesize as `[ko]` rows in the action log.
- Status button in action menu opens a unit detail panel showing stats, equipment, abilities, and active statuses.
- Battle end triggers a results screen: winner, MVP unit (or no MVP), KO timeline, return-to-log button.
- `projection.ts:142` defensive clamp removed; projection contract tests still green.

Tests at 622+, 0 failing. New pure-logic surfaces covered.

## Pre-implementation plan (required)

Before code, plaintext plan covering:

### Required first step: current-tree audit

Articulate, for each surface this session touches:
- What already exists
- What state it's in
- What this session does to it (refit, replace, remove, leave alone)

### Architectural decisions

After the audit, the plan addresses:

1. **Forecast computation location.** The audit confirmed the projection contract is sufficient; this session wires it. Where does the forecast helper live — `src/engine/projection/forecast.ts`, a UI-side composer pulling from existing projection queries, or extension to an existing projection module? State the choice; justify. Forecast helper takes (state, catalog, actor, action, target) and returns a structured forecast: damage range (min/expected/max per target), hit chance per target, status application chance per (status, target), AoE footprint with per-tile target identification.

2. **AoE preview vs. forecast hover overlap.** Session 23's targeting overlay already shows AoE footprint via the highlight layer's overlay channel. The forecast hover adds *information density* — per-tile target identification, per-target damage and status numbers. Is the forecast hover a tooltip near the cursor, a fixed panel in a HUD region, or both (compact tooltip + detailed panel)? Design doc has guidance; confirm against it.

3. **Projection column placement and structure.** Where does it live in the 4-region shell? Likely the right region alongside or replacing part of the action log. Or a new fifth slot. Read battle-ui-architecture.md's projection column section closely. Content layers:
   - **In-flight charged actions:** units mid-cast, what they're casting, target if visible, resolution-CT
   - **Reaction queue:** queued reactions waiting to fire — what's in queue, in what order
   - **CT-ordered turn forecast:** several upcoming turns beyond what QueueTower shows; the boundary with QueueTower is the key design question
   - State the data sources (new projection queries vs. existing).

4. **`projectChargedActionResolution` and `projectTurnEndCT`.** These engine queries are listed in the design doc and deferred from Session 23. Implement now if needed for projection column, or skip if existing queries cover the content. State which.

5. **QueueTower 20-event horizon + scrolling.** Session 22 shipped 7-event. Expand to 20. Scrolling within the QueueTower — wheel, drag, or both. Layout question: does the QueueTower's visible area get taller (using full left-region height) or stay short with overflow scrolling? Design doc has guidance.

6. **KO synthesis: derived-events stream vs. formatter-local.** The handoff flagged that `[ko]` rows require HP-crossing-zero detection over the action log. Two paths:
   - **Derived-events stream:** a separate module scans the action log and emits a `[ko]` event when a damage action drops a unit's HP to 0; multiple UI consumers (log panel, results screen KO timeline, hover-counterpart) read the same stream.
   - **Formatter-local:** the action-log formatter tracks running HP as it walks the log; emits `[ko]` rows inline.
   
   The derived-events stream is more work upfront but pays back if click-to-expand, hover-counterpart, results screen KO timeline, and MVP-unit calculation all need similar derived data. State the choice.

7. **Click-to-expand action log entry.** What does expanded view show? Action details (numbers behind the human-readable summary — exact damage, status roll outcomes, hit roll outcome, target resistance values applied)? Action log row is one source of truth; expanding pulls more from the underlying action entry. State the contents.

8. **Hover-counterpart highlighting.** Hovering an action log row highlights the actor and target on the canvas. Uses what — the highlight layer's two channels, a third channel, a transient sprite tint? State the visual idiom.

9. **Status button activation: unit detail panel.** Status button currently disabled with "(Session 24)" tooltip. Activates this session. Panel contents: unit's current stats (HP/MP/SPD/CT, plus secondary stats), equipped items, available abilities (R/S/M plus active command sets), current statuses with durations / stacks / source. Panel placement: replaces QueueTower's anchor temporarily, separate modal, fixed side panel, or other. State the choice. Trigger sources: Status button in action menu, click on unit in QueueTower, click on unit on canvas — which trigger sources work in v1?

10. **Results screen.** Trigger: `battle_end` action commits. Content per design doc: winner side, MVP unit (definition? highest damage dealt, highest unit-KOs caused, or "no MVP" if multiple are close?), KO timeline (sourced from derived-events stream or directly from action log), log replay button (opens the existing action log panel? scrubs through it? v1 likely just "show the full log"). State the content and what each piece sources from. Pause-overlay-like modal or full-screen takeover or in-shell panel? State.

11. **`projection.ts:142` clamp cleanup.** Drop the `Math.max(0, Math.min(1, crit_chance / 100))` since ADR-0034's upstream clamp covers it. Confirm the projection contract test in `src/ai/projection.test.ts` (or wherever) covers the composed behavior, re-run, confirm green. State this as an explicit deliverable.

12. **CT cost preview in action menu.** Each ability already has `actSpd` in its definition. Render it next to MP cost in the ability list. Layout question only.

13. **Test strategy.** Forecast helper, KO synthesis (if derived-events path), projection column data composition — all pure logic, all unit-testable. Visual surfaces continue to rely on manual verification. State which is which.

14. **24a / 24b split lines.** Surface area is comparable to Session 23, which didn't split. But this session's surface is more interconnected (forecast hover, projection column, CT cost preview all touch the projection engine; results screen, KO annotation, click-to-expand, hover-counterpart all touch the action-log/derived-events surface). Proposed split lines if needed:
    - **24a:** engine projection extensions + forecast hover + CT cost preview + projection column + `projection.ts:142` cleanup (the projection-engine-driven cluster)
    - **24b:** results screen + KO synthesis + click-to-expand + hover-counterpart + Status button + QueueTower 20-event horizon (the polish + reflective cluster)
    
    The audit may suggest different lines. Settle in the plan; don't discover mid-implementation.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, work lands roughly in plan order. Items are outcomes; the plan determines approach.

### Item 1: `projection.ts:142` defensive clamp cleanup

Drop the now-redundant `Math.max(0, Math.min(1, crit_chance / 100))` since ADR-0034's upstream `critRoll` clamp covers it. Re-run `src/ai/projection.test.ts`; confirm green.

### Item 2: Engine projection extensions

Light extension to the projection module per audit Item 19. New helpers as needed for forecast hover and projection column: `projectDamageRange`, `projectStatusApplicationChance`, AoE per-target preview, `projectChargedActionResolution`, `projectTurnEndCT`. Use existing pure functions where they compose; add new ones only where data isn't already exposed. New helpers come with unit tests.

### Item 3: Forecast hover

Wires the engine forecast into the target-selection state of the turn-flow state machine. When a target is selected or hovered, the forecast displays:
- Damage range (min / expected / max) per affected target
- Hit chance per target (if applicable)
- Status application chance per (status, target) accounting for caster Faith × target resistance × status modifiers
- AoE per-target preview (the existing AoE footprint plus per-tile target identification)

Display surface per the plan (tooltip, panel, both).

### Item 4: CT cost preview in action menu

Render each ability's `actSpd` value next to MP cost in the ability list.

### Item 5: Projection column

New UI surface (or extension of existing) showing in-flight charged actions, reaction queue, and CT-ordered upcoming turns. Updates per action commit. Reads from projection queries (existing + new from Item 2).

### Item 6: QueueTower 20-event horizon + scrolling

Expand from 7 to 20 visible events; add scrolling for events beyond the visible window. Layout retains the active-unit anchor at the bottom.

### Item 7: KO synthesis

`[ko]` rows synthesized as units' HP crosses zero. Implementation per plan choice (derived-events stream or formatter-local). If derived-events: the stream lives in a module readable by the log panel, results screen, hover-counterpart, and MVP calculation.

### Item 8: Click-to-expand action log entries

Each row clickable; expanded view shows action details behind the human-readable summary. Collapse on second click or click-outside. Per-row state; multiple expanded rows allowed.

### Item 9: Hover-counterpart highlighting

Hovering an action log row highlights actor and target on the canvas. Visual idiom per the plan (highlight layer channel, sprite tint, or other).

### Item 10: Status button activation → unit detail panel

Status button in action menu opens unit detail panel. Contents per the plan. Panel surface (modal, side panel, replacement) per the plan. Other trigger sources (canvas click, QueueTower click) per the plan.

### Item 11: Results screen

Triggers on `battle_end`. Displays winner, MVP unit (or none), KO timeline, return-to-log button. Layout per the plan. Post-results state is "battle over, can review log, can ESC to pause overlay" — v1's Quit-to-title remains stubbed per ADR-0041.

## Acceptance criteria

- Forecast hover surfaces damage range, hit chance, status application probabilities, and AoE per-target preview during target selection. Verifiable on any ability with a target.
- Projection column visible; updates per action commit; shows in-flight charged actions, reaction queue, and upcoming turns beyond QueueTower's view.
- Action menu shows CT cost next to MP cost per ability.
- QueueTower shows 20 events, scrollable for beyond-visible entries.
- Action log entries click-to-expand for detail; hover-counterpart highlights the actor/target on canvas.
- `[ko]` rows appear in the action log when units fall.
- Status button activates the unit detail panel; panel shows stats, equipment, abilities, statuses.
- Battle end triggers the results screen with winner, MVP (or none), KO timeline, log review button.
- `projection.ts:142` defensive clamp removed; projection contract tests green.
- Test count: 622+ passing, 0 failing. New pure-logic surfaces covered.
- ADRs written for: forecast computation location, KO synthesis approach, results screen architecture, projection column structure. Other ADRs at implementer's discretion.
- `handoff.md` updated with MVP-readiness summary and empirical-questions checklist for Chris's playtest.

## Out of scope

- **Save / load / replay scrubbing.** Phase F.
- **Real art / sound.** Post-MVP.
- **Title screen.** Session 34.
- **Quit-to-title.** Session 34. v1's stubbed button stays.
- **Surrender flow.** Session 34.
- **Team builder, deployment phase, battle setup screen.** Phase E.
- **Equipment expansion beyond what's already in tree.** Phase C.
- **Map mechanics beyond Training Field.** Phase D — River Ridge waits for Cluster 6.
- **Animation polish beyond what already exists.** No new tween logic, no particle effects, no fancy KO transitions.
- **rAF vs. setInterval revisit.** Stays on setInterval per Session 23's ADR-0040. Revisit later when vsync-smoothness matters.
- **MP / status snapshot ahead-of-tween fix.** Known limitation; address in later polish.

## Files likely touched

A non-exhaustive list anchored to current-tree assumptions; the audit confirms / corrects:

- `src/engine/projection/forecast.ts` — new (or alternate location per plan)
- `src/engine/projection/` — possible new helpers for charged-action resolution, turn-end CT
- `src/ai/projection.ts` — clamp cleanup at line 142
- `src/ai/basic.ts` — possibly affected if new projection helpers replace inline composition
- `src/ui/forecast-panel.tsx` (or tooltip module) — new
- `src/ui/projection-column.tsx` — new
- `src/ui/unit-detail-panel.tsx` — new
- `src/ui/results-screen.tsx` — new
- `src/ui/derived-events.ts` (or `ko-synthesis.ts` if formatter-local) — new
- `src/ui/action-log-panel.tsx` — extended for click-to-expand and hover-counterpart
- `src/ui/action-log-format.ts` — possibly extended for `[ko]` row formatting
- `src/ui/queue-tower.tsx` — refit for 20-event horizon + scrolling
- `src/ui/action-menu.tsx` — refit for CT cost preview and Status button activation
- `src/ui/battle-hud.tsx` — wire projection column, possibly results screen mounting
- `src/ui/use-turn-flow.ts` — possibly extended for forecast and hover-counterpart wiring
- `src/renderer/highlight-layer.ts` — possibly extended for hover-counterpart channel
- `src/renderer/battle-renderer.ts` — possibly extended for hover-counterpart APIs
- `src/app/BattleView.tsx` — possibly extended for results screen trigger and unit-detail-panel state
- `src/ui/index.ts` — exports
- New tests for forecast helper, KO synthesis, projection column composition, derived events, results-screen content composition.
- New ADRs in `docs/adr/`:
  - `ADR-XXXX-forecast-pipeline.md`
  - `ADR-XXXX-ko-synthesis.md` (or whatever the derived-events approach lands as)
  - `ADR-XXXX-results-screen.md`
  - `ADR-XXXX-projection-column.md` (if substantial enough)
- `docs/handoff.md` — updated.

## Workflow notes

- **Plaintext-first review required.** Same discipline as 22, 23. Plan reviewed before code.
- **Audit-first within the plan.** Current-tree audit grounds everything else.
- **MVP-readiness framing.** "Done" means playable and evaluable. Avoid over-polishing surfaces that Chris's playtest will give specific feedback on. Get the surfaces functional and structurally clean; iterate on tone and density after empirical feedback.
- **24a/24b split decision in the plan.** If the audit reveals more refit work than expected, propose a split with concrete lines before starting implementation. The suggested split (projection-engine cluster vs. polish-and-reflective cluster) is in plan section 14.
- **Mid-session design questions** route via the conduit to the planner. Architectural surfaces in this session (forecast computation location, KO synthesis approach, results screen layout) are high enough leverage that surprises should pause-and-confirm rather than route through a unilateral call.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated to it. Playable runtime continues to use `trainingFieldBattle`.

## Watch-fors carried forward

**Addressed this session:**
- `projection.ts:142` defensive clamp cleanup (Session 21 carry-forward; fires here since forecast work touches projection)
- KO annotation in action log (Session 23 carry-forward)
- Status button activation (Session 23 carry-forward)
- CT cost preview annotations (Session 23 carry-forward)
- QueueTower 20-event horizon + scrolling (Session 22 carry-forward)
- Click-to-expand and hover-counterpart in action log (Session 23 mention)
- `projectChargedActionResolution` / `projectTurnEndCT` engine queries (Session 23 deferral)

**Not addressed this session, carried forward:**
- Top bar `Turn T####` is O(n) on `actionLog` (Session 22). Not regressed; cheap on 14×14; defer to whenever log size becomes visible.
- Renderer's MP "max" captured at mount (Session 22). Replaces with `maxMp` lookup once Session 28 (Cluster 4) ships.
- Status-badge polarity convention `tags`-based vs `polarity?` field (Session 22). No urgency.
- rAF vs setInterval revisit (Session 23). Future-when-vsync-smoothness-matters.
- AoE preview correctness across all shapes (Session 23). Will be exercised under playtest.
- MP / status snapshot ahead-of-tween (Session 22). Known limitation.
- `docs/content-snapshot.md` drift (Session 21 carry-forward). Session 26 refresh.
- Resistance composition cap at 100 (audit E2). Session 27.
- `pa_factor NotYetImplementedError` (audit E3). No content asks.
- `equipmentContributionsFor` "branch per hook" (audit E4). Session 27.
- TS strict-mode test errors (audit E8). Not blocking.
- Surrender flow (Session 34).

## Estimated size

Large. Comparable to Session 23's 10-item plate, with tighter cross-coupling (projection layer threads through forecast, CT preview, and projection column; derived events stream threads through KO synthesis, hover-counterpart, results screen). The plaintext plan with tree audit is real work. If the plan's audit reveals scope larger than one session can carry cleanly, the 24a/24b split is the right move — propose with concrete lines, confirm before implementation.

## Note on the empirical check-in

This is the last brief before the MVP empirical check-in. After Session 24 lands (whether single-session or 24a/24b), Chris plays the build and brings empirical feedback back through the conduit. Phase B planning calibrates against that feedback. Specific questions Chris will be evaluating during playtest:

- **Brave 70 reaction-trigger feel.** Reactions firing at ~70% per BMG. Does it feel arbitrary or sufficiently reliable?
- **Storm Caller AI behavior.** Does the AI ever cast Storm Caller? Or is `SELF_COST_DAMPING_FACTOR` still suppressing it?
- **Fixed-CT-0 starting tempo.** Currently all units start at CT 0 (Cluster 2's randomization variant ships in Session 25). Does the deterministic opening feel stale or fine for MVP?
- **UI ergonomics under real play.** Action menu navigation tempo, forecast hover information density, projection column readability, results screen completeness.
- **Action log readability.** Are entries discoverable? Is the formatter's level of detail right?
- **AoE preview correctness.** Across all the AoE shapes the mages cast.
- **Pacing.** Animation timings, turn transitions, log update rate.

The handoff at end-of-session should summarize MVP-readiness and any limitations the implementer noticed during preview verification — this informs Chris's playtest priorities and what to specifically attend to.
