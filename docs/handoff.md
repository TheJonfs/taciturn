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

## From session 2026-05-03 (first playable battle)

### Suggested next-session scope

This session closed roadmap entry 13 ("first playable end-to-end battle"). The roadmap's main numbered sequence ends here; the next session is the first one that doesn't have a pre-numbered slot. Two reasonable framings, both real:

1. **Take `docs/progress.md` to a planning conversation** to scope the next round of engine vs content work. The progress doc was written specifically for this. Output of that planning session is one or more new roadmap entries.

2. **Pick a small content-expansion pass** without going through planning, on the grounds that one or two more passes will surface the right scoping signal. Concrete candidates:
   - **Add a second class** (Priest is the obvious one — gives the demo battle Knight + Priest per side, makes White Magic on a non-Knight class thematically clean, exercises class-pinned First Action across two distinct values).
   - **Add a new map with elevation.** Exercises jump and LoS in actual play.
   - **Generalize the ActionMenu to the FFT-style ability picker.** Replaces the hardcoded Attack/Cure buttons with a generic per-command-set submenu. Modest UI session.

My recommendation if forced: framing 1 (planning) — the deferred-work surface is broad enough now that picking the next thing without a plan risks doubling back on a different priority later. But framing 2's content sessions are all small and any of them is fine to land first.

### Things noticed during the session

- **`docs/progress.md` is new.** It was created this session as input to the planning conversation Chris flagged. It's intended to live as a durable, periodically-refreshed snapshot — distinct from the roadmap (sequenced) and the handoff (transient). Refresh discipline is open: probably "refresh after every 3–4 sessions" or "refresh whenever it goes meaningfully out of date." Worth deciding when the next planning session lands.

- **Dev-only debug hook in `BattleView`.** `import.meta.env.DEV`-gated `window.__taciturnDebug` with `tick(ms)`, `pump(n, msPerTick)`, `getState()`, `isIdle()`, `uiEndTurn()`, `uiSubmit(action)`. Replaces the temporary "add and remove before commit" pattern session 12 used. Future browser verifications can use this directly. The synthetic-clock detail (Pixi's `app.ticker.update()` reads wall-clock `performance.now()`, which barely advances inside a tight JS loop) is comment-documented in the source — anyone driving the orchestrator from a preview eval needs to use `pump(n, msPerTick)` and not a tight `update()` loop.

- **The `uiSubmit` debug helper accepts ProposedAction.** Not validated against the catalog before submission — `validateAction` runs at commit time, so an invalid debug submit fails loudly through the orchestrator. That's fine for a dev surface.

- **Mid-turn KO bug surfaced during integration testing.** Counter creates a chain that can KO the *active* turn-holder, leaving `turnState` pointing at a corpse. ADR-0013 captures the orchestrator-side defensive guard and the deferred engine-side fix. The defensive guard inside `decideBasicAi` was added too — belt-and-suspenders, makes the AI honest as a standalone library.

- **No second AI tier evaluation infrastructure.** The integration test runs 5 seeds × 2 team assignments and asserts coarse properties (terminate, AI ≥ greedy). Healing didn't break this. When a meaningfully-stronger AI tier ships, the eval bar wants to grow — a tournament suite, summary stats, etc. Not blocking today; flagging because the next AI session will want this on day 1.

### Things considered but did not do

- **Generalize the ActionMenu to a real ability picker.** The session-13 cure UI hardcodes a Cure button alongside the Attack button. The right design is "ActionMenu reads each equipped command set and renders one button per active member; the picker submenu drives target-selection." Skipped — would have doubled the session scope; the hardcoded approach matches the existing Attack pattern and is forward-compatible (the picker is a future refactor).

- **Engine-side auto-emit `turn_end` on active-unit KO.** Architecturally cleaner than the orchestrator-side guard. Skipped — real policy decision (when exactly does it fire?), warrants its own ADR session. ADR-0013 captures this explicitly.

- **AI move-to-heal.** Heal phase only fires when a wounded ally is in cure range from the actor's *current* position. A heal-aware move-scoring pass is the obvious next refinement. Skipped — the v1 demo already shows useful heal behavior (red_knight_n cured red_knight_s mid-battle, observed in browser); the move-to-heal refinement waits for content where it's distinguishably needed.

- **Stat-hooks-aware maxHp in the AI heal threshold.** The threshold uses `unit.baseStats.maxHpBase` directly. The architecturally correct version walks `runModifyStatQuery(state, catalog, { unit, statName: 'maxHp', baseValue: u.baseStats.maxHpBase })`. Skipped — no v1 content modifies maxHp at runtime, so the values are identical. Lands when the first maxHp-modifying status / equipment effect ships.

- **A `'mp'` stat-name + MP-cost validation via the modify-stat-query pipeline.** Same shape as the maxHp note. Currently MP cost is gated against `unit.vitals.mp` directly in `validateAction`. Skipped on the same "no consumer yet" grounds.

- **Charged AI ability handling.** Cure happens to be `chargeTicks: 0`. When charged abilities ship (engine session, deferred), the AI will need to reason about commit-now / cast-at-trigger; today it'd just commit and the engine would throw. Skipped — gated on the charged-action engine session.

### Open questions for later sessions (not blocking)

These are NOT carried forward in the "carried, carried, carried" pattern this file used to use. The detailed durable record now lives in `docs/progress.md` (sections "Engine policy / cleanup gaps" and onwards). Future sessions should *read progress.md*, not look here for the deferred-work catalog.

What this section is for instead: things genuinely specific to *this* session's state that the next session might want to know about.

- **The dev `__taciturnDebug` hook should probably get a documented usage note** somewhere (CLAUDE.md? `docs/architecture/`?). Right now its existence is only discoverable via the `BattleView.tsx` source. Low priority; flag for the next time someone touches that area.

- **2v2 still has the symmetric-fixture property** that the session-12 handoff flagged for 1v1. Both teams have identical stats, loadouts, and Counter, so first-mover bias still dominates the `0xDEC0DE` seed playthrough. The integration test handles this by running both team assignments. When asymmetric content ships (a Knight + Priest setup with different roles per unit), the bias relaxes naturally.
