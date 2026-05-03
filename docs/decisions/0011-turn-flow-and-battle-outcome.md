## ADR-0011: Turn flow, battle outcome, scheduler, and reaction fizzle

**Status:** Accepted
**Date:** 2026-05-03

## Context

Sessions 1–8 built the data substrate, hook system, action loop, and damage pipeline. Session 9 closes the engine's turn cycle: it adds the missing pieces between consecutive turns (CT advancement, next-event scheduling), the missing pieces inside a turn (turn-skip for Stop / Sleep), and the missing pieces at the end of a battle (outcome evaluation + battle_end emission). It also lands the session-8 carry: reactions that fail validation in-chain should fizzle silently rather than throw.

Decisions in scope:

1. **Where `evaluateBattleOutcome` is called.** Inside `reduceTurnEnd` (emits `battle_end` as a generated action), or by the orchestrator after `turn_end` commits.
2. **Whether `reduceTurnEnd` self-emits the next `turn_start`.** Reducer-driven self-perpetuation, or orchestrator-driven scheduling via a separate `advanceToNextEvent` function.
3. **Turn-skip mechanism.** A new `queryTurnSkipped` hook fired at turn_start, or reusing `onActionAttempted` with engine inspection at turn_start time.
4. **`BattleOutcome` shape.** A discriminated `{ kind: 'ongoing' | 'decided' }` union, or a `Decided`-only shape with the presence/absence of `state.outcome` doing the discrimination.
5. **Where `victoryConditions` live.** Read from `BattleConfig` at every turn_end (passing the config through), or copied onto `GameState` at `createInitialState` so reducers don't need extra inputs.
6. **`battle_decided` guard.** Where to enforce "no further actions process once outcome is set" — `validateAction`, `commitAction`, or both.
7. **Reaction fizzle scope.** Drop only on the reaction's own validation failure, or also on `onActionAttempted` blocks for reactions, or also on chain-depth-cap (no — that's different).
8. **Scheduler purity.** Pure projection (read-only) returning a proposed action, or stateful (advances `state.tick` and unit `ct`).
9. **Initial-CT formula variants.** Whether to add the speed-based + variance variant in this session.

## Decision

**`evaluateBattleOutcome` is called inside `reduceTurnEnd`.** When an outcome is decided, the reducer pushes a `battle_end` system action onto `generatedActions`. The chain processor commits it next; `reduceBattleEnd` writes the decided outcome to `state.outcome`. This matches the design's "turn_end is the standard checkpoint" rule and keeps the battle-end event in the action log (replayable, observable to UI). The chain processor reads `state.outcome` after each commit and silently drains remaining queued entries — reactions or status_ticks emitted before `battle_end` that haven't yet committed don't run, by design.

**`reduceTurnEnd` does NOT self-emit the next `turn_start`.** Each reducer's job is "apply this action's effect"; turn-to-turn handoff is a different beat. The new `engine/turn/scheduler.ts` ships `advanceToNextEvent(state, catalog) → ScheduledAction | null`, which the orchestrator (UI / AI driver) calls between turns. UI animation pacing, AI thinking time, network round-trips on online play live at the orchestrator level — keeping the scheduler separate from reducers means those concerns compose without reaching back into engine internals. The chain processor handles tightly-coupled in-turn emissions (status_tick, reactions, battle_end); the scheduler handles the looser between-turn handoff.

**Turn-skip is a new `queryTurnSkipped` hook.** Fired once at `turn_start` against the active unit's hook chain. Returns `{ reason: string }` to skip, `null` to proceed. The runner short-circuits on the first non-null — Stop / Sleep / Petrify return their reason; default-acting statuses don't register on this hook at all. Reusing `onActionAttempted` would force the engine to "try" each action and observe the block, with no clean signal at turn-start time about whether the player decision phase should run at all. The dedicated query is cleaner and matches the design doc's structure ("Check turn-skip conditions" as step 3 of turn_start).

**`BattleOutcome = DecidedOutcome` (no discriminant on the type itself).** `state.outcome: BattleOutcome | undefined` already provides the ongoing-vs-decided signal — adding a `kind` discriminant on the type duplicates that. The function-return type `EvaluatedOutcome` is a discriminated union (the evaluator answers ongoing-or-decided in one call), but the *stored* shape is just the decided body.

**`victoryConditions` is copied onto `GameState` at `createInitialState`.** The reducer reads it directly. This avoids passing `BattleConfig` to reducers (which today only see `state` and `catalog`). The conditions don't change mid-battle (a battle's win/loss rules are part of its identity), so the copy is one-shot and correct.

**`battle_decided` guard lives in `commitAction`.** The chain processor checks `state.outcome !== undefined` before each queue entry. A root-action call past battle-end returns `{ ok: false; stage: 'battle_decided' }`; a mid-chain entry post-battle-end is silently drained. Putting the check in `validateAction` would force every reducer-internal validation path to know about it; `commitAction` is the single chokepoint where it belongs. The new `'battle_decided'` discriminant joins `'validation' | 'hook_blocked'` on `CommitFailure`.

**Reaction fizzle: validation failure on a reaction-tagged chain entry drops silently.** The chain processor checks `entry.isReaction` on validation failure; reactions continue, non-reaction system-emitted actions still throw (status_tick / turn_end / battle_end / charged_action_resolve all skip validation in `validateAction`'s default branches, so the throw path stays loud for actual bugs). `onActionAttempted` blocks for reactions stay as-is (already silent-drop in session 7's chain logic). Chain-depth-cap stays a throw.

**Scheduler is stateful: it advances `state.tick` and unit `ct`.** Pure-projection mode (returning the proposed action without state changes) would force the orchestrator to either apply the CT delta itself (re-implementing the math) or commit a "tick advance" system action (a new action type with no real semantics). The stateful version is one function call away from a clean handoff: `(newState, proposed) → commitAction(newState, proposed, catalog)`. KO'd units are filtered from the scheduler's snapshot — they don't trigger turns. Returns `null` when the battle has decided, when a turn is in progress, or when no entity can ever trigger.

**Initial-CT speed_with_variance variant lands now.** Single-line cost (one new discriminant, one new clause in `resolveInitialCT`). Formula: `clamp(spd × speedFactor, 0, 99) + (stable_hash(seed, unitId) − 0.5) × (variancePct/100) × threshold`. v1 default leaves the ruleset on `'fixed'` for test stability; future battle configs that want feel-based opening order opt in. Stable per-unit (same seed + same unitId always lands at the same value) so replays stay deterministic.

## Consequences

- **Battle-end is an action in the log.** Replays walk the log forward, see `battle_end`, and reconstruct the decision. UI consumers reading the log can render the "win/lose screen" trigger from the action stream rather than polling `state.outcome`. The action's outcome carries the description + winner + condition index for display.

- **The scheduler is the *only* thing that advances CT in the engine.** Reducers don't touch `state.tick`; only the scheduler's `advanceToNextEvent` does. This makes "what does this action do to time?" answerable in one place (`scheduler.ts`'s ticksAdvanced math). When charged-action timing-modifier abilities ship (Quick / Slow on a charged action), the modifier composes through the scheduler's CT calculation, not through a reducer side-effect.

- **`commitAction` returns three failure stages, not two.** UI code that branches on `result.stage` needs the new `'battle_decided'` arm. v1 UI is not yet written, so this is a forward-only addition.

- **Reaction fizzles are silent today.** No `reaction_fizzled` system event. The design intent was "log a system event for visibility"; v1 omits the event because there's no consumer (UI/log viewers don't exist yet). When the renderer or a debug-overlay consumer wants visibility, the event lands as a one-line addition: `commitAction` pushes a `reaction_fizzled` action onto the log instead of `continue`-ing.

- **Stop and Sleep can share `queryTurnSkipped`.** Stop returns `{ reason: 'stopped' }`; Sleep would return `{ reason: 'asleep' }` and additionally register an `onDamageReceived` handler that wakes the unit (removes the Sleep status). The hook surface composes — neither status is special-cased in the engine.

- **`makeGameState` test fixture gained `teams`, `victoryConditions`, and `outcome` fields.** Default values keep existing tests untouched (`teams: []`, `victoryConditions: []`, no `outcome`). New tests that exercise the outcome path opt in.

- **The turn-skip path doesn't fan out `status_tick` actions.** A Stopped unit's per-unit-CT statuses skip their tick this turn — that's the design intent (Stop's effect is "the unit's clock pauses entirely"). When Sleep ships and we want Sleep statuses to *not* tick on the asleep turn but Poison to *still* tick, the skip path's status-tick logic refines per-status (a hook query similar to `queryTurnSkipped` for "tick on skipped turns"). v1 is Stop-only and the simple "no ticks during skip" rule is right.

- **The `battle_end` action's `actorId` field is omitted.** Battle-end is a system action with no acting unit; the envelope-builder's actor-omission switch grew a `battle_end` clause to match.

- **`createInitialState` now reads `masterSeed` for the speed-based-variance formula.** The `'fixed'` path is unchanged (ignores masterSeed). New variant deterministic by construction.

- **The scheduler's snapshot filters KO'd units.** This is a behavior change vs. the read-only `projectUpcoming` (which doesn't filter) — `projectUpcoming` is for UI projection display ("here's the upcoming queue"), and showing KO'd units there would surprise. Future: the projection should also filter KO'd units; flagged in the handoff for session 10's renderer work.

## Open questions / deferred

- **`reaction_fizzled` and `chain_truncated` system events.** Both are "fire-and-forget" log entries with no v1 consumer. Land as system action types alongside the renderer / debug-overlay sessions when there's something to show.

- **Per-status "tick on skipped turn" rule.** Today the skip path emits no `status_tick`s. Future Sleep + Poison interaction may want Poison-on-Sleep to tick. Refines via a per-status hook flag when content forces.

- **N-way battles (more than two teams).** `defeat_all`'s winner-derivation is "first team in `state.teams` other than the defeated side." For 3-side free-for-all this is wrong — the winner depends on which sides are still standing. Lands when the BattleConfig validator widens for >2 teams; v1 ships two-team battles only.

- **`survive_turns`, `reach_tile`, `protect_unit` victory conditions.** All additive — new discriminant + new clause in `checkCondition`. Land alongside content that needs them.

- **Forced-turn controllers (Berserk, Charm).** The hook surface (`onActionAttempted` returning `{ kind: 'replaced'; with: forcedAction }`) already supports them. The *AI controller for the replacement* lands with session 12's AI module.

- **Reaction validation and out-of-range counters.** Today fizzles silently. The design intent is "fizzle with a visible event"; ship the event when a consumer materializes.

- **Mid-turn budget grants.** Status-applied `+1 Move`/`+1 Act` on the active unit. No v1 content needs this. Two viable paths: a `modifyTurnBudget` hook query at turn_start, or a `budget_grant` system action emitted by status hooks. The action-emission pattern matches everything else; lean toward it when content forces. Defer.
