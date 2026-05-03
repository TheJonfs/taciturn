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

## From session 2026-05-03 (turn flow + battle outcomes + scheduler)

### Suggested next-session scope

Roadmap session 10: **Renderer skeleton.** First time the engine produces anything visible. Concrete deliverables per `docs/architecture/architecture-overview.md` ("Renderer"):

- PixiJS application bootstrap. Single canvas, window-sized, top-down orthographic.
- Tile rendering. Read `state.map.tiles`, draw flat-color squares per `terrain` type. Z-layer ordering for stacked tiles. No textures yet — solid colors per terrain (ground/water/wall/etc.).
- Unit sprites. Read `state.units.values()`, draw a colored circle per unit at its `position`. Color by team. KO'd units rendered grayscale.
- Camera / viewport. Center on the active unit when `state.turnState !== null`; pan smoothly between turns.
- Action-log subscriber. The renderer reads the action log and animates events: a `move` action interpolates the unit between path positions over a fixed duration; a `use_ability` flashes the target; `battle_end` triggers a "win/lose" overlay.
- One demo battle visible end-to-end. Two units, one map, one turn-cycle scripted via the scheduler.

The renderer reads engine state read-only — never writes. Engine code does not import from `src/renderer/` (CLAUDE rule 1, ADR-0001).

Two specific carries from this session that session 10 should fold in:

1. **Projection vs. scheduler difference: KO'd unit filtering.** `engine/ct/projection.ts`'s `projectUpcoming` does *not* filter KO'd units; the scheduler does. The renderer's "upcoming queue" UI reads from `projectUpcoming` and would currently show ghost entries for KO'd units. Either fix `projectUpcoming` to filter (cleanest), or document the difference clearly and have the renderer filter on read. Lean toward fixing projection; scheduler's filter is the right behavior for both.

2. **`reaction_fizzled` system event.** Today reaction-validation failures silently drop. When the renderer wants to show "Counter fizzled — target out of range," ship a `reaction_fizzled` system action type that the chain processor emits. One-line addition (push an action onto the log instead of `continue`). Don't need it before the renderer has a use, but session 10 may surface that need.

### Things noticed during the turn-flow session

- **`reduceTurnEnd` always runs to completion before `battle_end` evaluates.** The chain order is: `turn_end` reducer runs (sets state, generates `status_tick` for turn-based statuses, evaluates outcome, generates `battle_end` if decided). FIFO chain then commits `status_tick` first (decrementing turn-based statuses), then `battle_end`. This means a Poison-tick KO at the very end of the unit's own turn correctly fires `battle_end` on the same turn boundary. Validated by the integration tests but worth flagging: the order is FIFO over the generated array, which is `[status_tick..., battle_end]` (status_ticks pushed first inside `reduceTurnEnd`, battle_end pushed at end).

- **`evaluateBattleOutcome` runs *before* the post-turn-end status-tick chain.** So turn-based-status-tick KOs at *the same* turn_end don't fire battle_end on this turn — they fire next turn_end. v1 has no turn-based statuses with damage hooks, so this is a future-content concern. When Bleed-on-turn-end content lands, decide whether to re-evaluate after status_tick fan-out commits or keep the current "evaluate at turn_end's own resolution time" rule. Lean toward the latter (keep checkpoints predictable); flag if surprising.

- **The scheduler is the only thing that advances `state.tick`.** Reducers don't touch tick; the scheduler does. When charged-action resolution lands and we want fine-grained tick reasoning, the scheduler is where it goes.

- **`engine/ct/projection.ts` and `engine/turn/scheduler.ts` duplicate the "snapshot + tiebreak" math.** They do similar things (one is read-only projection over a horizon, one is mutate-state-to-next-event). Session 10 could refactor a shared helper if the duplication grates; today they're independent and the renderer hasn't shown what's needed.

- **Projection doesn't filter KO'd units; scheduler does.** Already flagged above. The right fix is in `projection.ts` (filter by `unit.vitals.hp > 0` in `buildSnapshot`), which keeps both call sites aligned. Session 10 territory.

- **Stop's `queryTurnSkipped` handler returns `{ reason: 'stopped' }` unconditionally.** Stop is "you can't act" full stop; no need to gate. Sleep would gate on incoming-damage tracking (wake on hit) which is a separate `onDamageReceived` handler that removes the Sleep status — not a `queryTurnSkipped` gate.

- **Skipped turns don't fan out per-unit-CT status_tick actions.** The `status_tick` loop in `reduceTurnStart` is bypassed on skip. This means a Stopped unit's Haste doesn't tick down on the skipped turn — Stop "freezes the unit's clock entirely," which matches FFT. When Sleep lands and we want Sleep to *not* tick Sleep itself but still tick Poison, the skip path's tick logic refines — flagged in the ADR.

- **`battle_decided` is a third `CommitFailure` stage.** UI code that branches on `result.stage` will need the new arm when UI lands. The only producer is `commitAction`'s top-of-loop guard.

- **`reduceBattleEnd` is defensive against double-commit.** If a second `battle_end` somehow gets to the reducer (shouldn't — `commitAction`'s guard refuses), the existing outcome wins. Belt and suspenders.

- **`speed_with_variance` initial-CT formula is stable per-(seed, unitId).** Mulberry32-style hash over `(masterSeed, unitId-string-hash)`. Two units with identical Speed land at different starting CT (deterministically); same unit at same seed lands at the same CT every replay. Default ruleset uses `'fixed'`; battle configs that opt into the variance variant override.

- **The scheduler's `ticksAdvanced` field is exported.** UI can use it for animation pacing ("interpolate between turns over `ticksAdvanced` ticks of camera time"). The orchestrator passes the advanced state to commitAction; the scheduler doesn't commit on its own.

- **`createInitialState` reads `battleConfig.masterSeed` for the variance formula.** The fixed path ignores it. Same masterSeed + same battle config → same opening state, every time.

- **`makeGameState` test fixture has new optional fields: `teams`, `victoryConditions`, `outcome`.** Defaults preserve every existing test.

- **Stop is a per-unit-CT-mode status.** Tested via `makeStatusInstance` with default duration; the duration ticks via the unit's *own* CT advancing — but its turn skips so the per-unit-CT tick doesn't fire on the skipped turn. This means Stop's duration doesn't decrement on a Stopped turn (the unit clock is frozen). FFT-faithful. When Sleep lands with `turn_based` duration, Sleep's duration would decrement on its own turn_end (which still fires after the skip's turn_start emits a turn_end as a generated action — turn-based statuses tick at turn_end, which still runs).

### Things considered but did not do

- **Self-perpetuating turn loop (reduceTurnEnd emits next turn_start).** Considered. Rejected per ADR-0011 — keeps reducers narrow and gives the orchestrator (UI / AI / animation) a clean handoff point.

- **`evaluateBattleOutcome` taking a snapshot of pre-resolved condition predicates.** Considered as an optimization (don't re-walk units every turn). Rejected — the unit map is small (v1: ≤ ~16 units) and the predicate is a single pass. Premature.

- **Reaction-fizzle event.** Considered. Skipped — no v1 consumer (UI not yet written). One-line addition when the renderer wants visibility. Keeps the action log smaller for v1.

- **A `reactor: UnitId` field on the `battle_end` action's outcome.** Considered for "X delivered the killing blow" UI. Rejected — that information is the *prior* action (the use_ability whose damage KO'd the last enemy). Battle_end records the *condition* that fired; the killing blow is one action earlier. UI computes the killer from the action log if it wants.

- **Per-status "tick on skipped turn" rule.** Today skip = no ticks. Considered adding a `tickOnSkippedTurn: boolean` flag on StatusEffectType. Rejected for v1 — Stop is the only skip status, and the all-or-nothing rule is right for it. Refines when Sleep + Poison interact.

- **N-way (>2 teams) `defeat_all` winner derivation.** Considered. Rejected for v1 — two-team battles only. The current "first non-defeated team in state.teams" works for that case; falls apart on 3-way free-for-all. ADR-0011 flags it.

- **`survive_turns`, `reach_tile`, `protect_unit` condition kinds.** All additive. Skipped — no content needs them in the v1 scope. The evaluator's switch is exhaustive and TypeScript will flag missing variants when they're added.

- **Mid-turn budget grants (`+1 Move` from a status).** Considered. Two paths floated (a `modifyTurnBudget` hook query at turn_start, or a `budget_grant` action emission). Skipped — no v1 content needs it. The action-emission pattern is the leading candidate when content forces. Flagged in ADR-0011.

- **AI controller and forced turns (Berserk, Charm).** Out of scope per the session intro. The hook surface (`onActionAttempted` replacement) already supports these; the AI module that produces the forced action's choice lands in session 12.

- **Refactoring projection.ts and scheduler.ts to share a snapshot helper.** Considered. Skipped for now — they're independent, and refactoring a shared helper before the renderer surfaces what it needs feels premature. Land if session 10 wants the shared shape.

- **Charged-action triggers in `advanceToNextEvent`.** The scheduler returns `'charged_action_resolve'` for charged-action triggers (the second branch of its return shape), but no test exercises that path because v1 doesn't yet ship charged-action content. The scheduler shape is forward-compatible; the path lands its first integration test alongside the first charged ability.

### Open questions for later sessions (not blocking)

- **Battle-end checkpoint on damage-application (not just turn_end).** The design doc says "some conditions also check on damage application, e.g., 'objective unit defeated'." Today only turn_end checks. When a kill-the-leader victory condition ships, the damage pipeline's apply step (or `reduceUseAbility`'s post-damage state) needs to call `evaluateBattleOutcome` and emit `battle_end` mid-resolution. Refactor the emission path through a small helper so both call sites share it.

- **`reaction_fizzled` and `chain_truncated` system events.** Land alongside the renderer / debug-overlay sessions when there's something to show.

- **Per-status flag for "tick on skipped turn".** Lands when Sleep + Poison-style content needs the distinction.

- **Initial-CT formula tuning.** Default ruleset stays on `'fixed'`. The `speed_with_variance` variant is available but no built-in battle uses it yet. Session 13 (first playable battle) may opt in for feel.

- **Action-log compaction on long battles.** Mentioned in session-7 handoff. Still deferred; renderer / replay consumers will surface whether memory is an issue.

- **Out-of-range counter / "Counter Magic at non-magical attack" gating semantics.** Today reactions silently fizzle on validation failure. When more reaction content ships (Auto-Potion needs an item, Reflect needs a spell), validation may be the wrong gate — a Counter that the unit *wants* to fire but can't reach the target is a different case from "Counter shouldn't fire here at all." Reaction-handler-level gating (the ones already in session 8's Counter) is the cleanest path; flag if v1 content surfaces friction.

- **Replay/spectator state-rebuild from action log.** The pieces exist (every action's outcome is stored, reducers are pure given seed). No replay function exists yet. Land alongside the first consumer (renderer's "rewind" feature, or online-play's "join in progress" feature).
