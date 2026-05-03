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

## From session 2026-05-03 (action types + reducer + commitAction)

### Suggested next-session scope

Roadmap session 8: **Damage pipeline.** With the action loop in place, damage is the natural next layer. Concrete deliverables per `docs/design/action-resolution.md` ("Damage pipeline"):

- `DamageContext` shape: attacker, target, sourceAction, sourceAbility, damageTags, baseDamage, multipliers, additives, variance, finalDamage. The seven-stage flow (base → attacker → target → environment → variance → cap → finalize). Stage handler refs in the ruleset (`damagePipeline.stages.*`) currently ship as empty arrays — session 8 fills them with v1 default handlers (FFT-flavored PA × WP for physical, MA × spellMultiplier for magical, holy/elemental tag amplifications, evasion / hit checks).
- Wire UseAbility's `effects.damage` path: the reducer reads the ability's damage spec, runs the pipeline against the target, applies finalDamage to vitals, fires `onDamageDealt` / `onDamageReceived` hooks at the appropriate stages.
- Healing as the same pipeline with tag inversion (the `'healing'` tag triggers the inverse application — handlers that read tags to decide direction).
- `chargeTicks > 0` plumbing: UseAbility creates the ChargedAction + applies the Charging status. `charged_action_resolve` runs the held effect through the same pipeline and removes the Charging status from the caster. The session-7 placeholder for `charged_action_resolve` (currently just removes from the chargedActions array) gets the real resolution body.
- `onActionTargeted` -driven reactions (Counter, Auto-Potion, Reflect): the runner exists in `engine/hooks/runners.ts`; session 8 calls it from the damage-application stage and enqueues returned reactions onto the action chain. Reaction caps in commitAction already do the accounting.
- A demonstration ability set: a real damage attack (Knight's `attack`), a real heal (`cure`), and at least one Counter reaction status to exercise the chain. Damage variance uses the per-action seed.

Two specific carries from this session that session 8 should fold in:

1. **`ASSUMED_TURN_CT_COST` is gone, but the projection still uses `ruleset.ctCosts.moveAndAct` as its conservative estimate.** When session 8 introduces actual per-action CT pushes (Quick, Slow), the projection won't see them — projection assumes the full Move+Act cost regardless. Per ADR-0003 this is intentional, but session 8 may want a flag for projection to consult ChargedAction CT pushes when they're predictable.
2. **`onActionAttempted` runner short-circuits on `blocked`.** Today no v1 content blocks; the runner is exercised only by tests. When Stop / Silence / Don't Move ship as content, verify the short-circuit is what you want — a Stop status applied alongside a Berserk replacement should still Stop (the cap-of-multiple-handlers test in `commit.test.ts` already covers this case but content may surface edge cases).

### Things noticed during the action-system session

- **`HookSourceTier` and `DEFAULT_HOOK_SOURCE_TIER_ORDER` are leaf types in `engine/types/`.** They migrated there in session 6 so `RulesetDefinition` can name them; the session-7 hook signature refinements (`onActionAttempted`'s `ProposedAction` arg) now reach back through `engine/types/action.ts` from `engine/hooks/hooks.ts`. The `types/ → hooks/` arrow stays clean: `hooks/hooks.ts` imports types from `types/`, never the reverse.
- **`StatusApplicationOutcome` moved from `engine/status/result.ts` to `engine/types/`.** Action outcomes (UseAbility's `perTargetResults`) need it; putting it in types/ keeps the engine types/ → engine/status/ arrow correct. The old name `StatusApplicationResult` is re-exported from `engine/status/result.ts` for back-compat — drop the alias if no v1 consumer relies on the legacy name.
- **`computeActionSpeed` gained a `catalog` parameter (session 6 carry).** Its session-1 signature was `(state, action)`; it's now `(state, action, catalog)`. The single existing call site in `projection.ts` was updated; `speed.test.ts` was updated. Future call sites should match.
- **`knightLoadout(args?)` is the canonical Knight-class loadout helper for tests.** It pre-sets `first_action: battle_skill` so the class-pin is satisfied. Use it instead of `loadoutOf({})` for any test that goes through `validateLoadout`, `setActiveBucket`, `equipPassive`, or `createInitialState`. Tests that bypass validation (just build state via `makeGameState`) can keep using `EMPTY_LOADOUT`.
- **`activeTurnFor(unitId)` builds a turnState with default budget for tests that need a unit mid-turn.** Saves the inline-construction noise; everything in `engine/actions/`'s tests uses it.
- **The reducer `ReduceResult<T>`'s `T` is the kind-specific outcome; the dispatcher widens to `ActionOutcome` via a small cast.** TS can't narrow a switch's return type back to the union without help; the cast is local and documented in `reduce.ts`. Don't propagate it outward.
- **`commitAction`'s reaction-cap accounting only fires for actions tagged `isReaction: true`.** Today no reducer marks a generated action as a reaction (status_tick from turn_start isn't one). Session 8's damage-pipeline reactions should set the flag on enqueued reactions so the cap actually applies; the runner in `commitAction` is ready.
- **`chargeTicks > 0` in UseAbility throws.** Tested for. Session 8's first charged ability lights up the branch; the throw makes the gap visible.
- **`charged_action_resolve` is a skeleton.** The reducer removes the ChargedAction from the queue and returns an empty `perTargetResults`. The actual effect resolution + Charging-status removal land in session 8 alongside the chargeTicks > 0 path.
- **`onMoveStep` hook still has `unknown` in its args.** Session 7 refined `onActionAttempted` and `onActionTargeted`; `onMoveStep` was left because no reducer fires it yet. When the move reducer or a movement-step trigger needs it (forced movement, trap tiles), refine the args at that time.
- **The `committed` array on `CommitSuccess` mirrors the action log delta.** It's the same actions that were appended to `state.actionLog`, in the same order, with their outcomes. Tests use it to assert on what happened without diffing the whole log. Some users may prefer reading state.actionLog directly; both are valid.
- **Chain depth is throw-on-exceed today.** When the design's `chain_truncated` system event ships, the throw becomes a logged outcome instead. Until then, throw is loud and right.

### Things considered but did not do

- **Per-kind reducer files (one file per branch).** Considered. With 8 branches at ~40 lines each, one file totaling ~320 lines is more navigable than 8 files. The per-function exports keep individual reducers testable. Revisit if any single branch grows past ~100 lines.
- **`onActionAttempted` threading allowed/blocked through every handler.** Rejected. Short-circuit-on-blocked matches the design's "Stop blocks all actions" intent; threading would let a downstream handler "unblock" which has no use case in v1.
- **`commitAction` retrying replaced actions through the runner a second time.** Rejected. A handler that replaces returns the new action; subsequent handlers in the same firing see the replacement. Re-firing the runner against the replaced action would re-invoke the same handler that just replaced it — infinite loops in the limit. The current single-pass with replacement-thread is enough.
- **A `commitProposed` helper that wraps a proposed action in an envelope without committing.** Considered as a UI affordance for displaying "what the seed would be." Rejected — UI doesn't need that; if it does, expose `deriveActionSeed` directly (already exported).
- **Per-handler state-mutating hooks.** `onTurnStart` / `onTurnEnd` hook handlers return void today — they can't mutate state. The design intent is they fire as side effects (e.g., regen logs but doesn't apply HP — apply via a separate emitted action). For v1 we don't have any consumer; the void return stays. When status_tick handlers want to apply damage from Poison or healing from Regen, the action emission pattern is the answer (status_tick emits a damage/heal action that goes through commitAction).
- **`reduceStatusTick` calling `engine/status/remove.ts` for the duration-expiry path.** Considered for cleanness. Today the tick reducer just filters the instance out of the array. When a status with an `onRemove` handler that needs to fire on duration expiry ships, route through `removeStatus` (which handles the lifecycle); flag the change here.
- **A `commit_log_replay` helper that walks an action log and re-applies through the reducer.** Considered for replay testing. Skipped — replay reads `outcome` from the log rather than re-computing, per the design's "outcome is source of truth" rule. A separate `replayLog` function lands when there's a real consumer (the renderer's animation pacing, for example).
- **First Action class-pin enforcement at the reducer level.** Considered (per session-5 handoff). Rejected — `validateLoadout` is the single rule cover for every loadout-changing path. Cleaner; one less special case.

### Open questions for later sessions (not blocking)

- **Status_tick lifecycle: when does a tick fire onTick handlers?** Today the reducer decrements duration and removes on expiry. Per design, `onTick` handlers fire (for Poison damage, Regen healing). The runner shape exists (`onTick: { args: { unit }; return: void }`); no consumer drives it yet. Session 8 likely lands the first onTick handler when Poison content ships.
- **Charging-status removal on caster KO / displacement / target loss.** Per `ct-system.md` and `action-resolution.md`. The skeleton in `reduceChargedActionResolve` doesn't handle interruption. Add when content forces the question.
- **AoE / multi-target UseAbility.** Today targeting is `'self'` or `'single_unit'`. AoE shape data from `engine/map/aoe.ts` exists; UseAbility doesn't consume it. Add the `'aoe'` targeting variant (and AoeTargetSpec on the action payload) when an AoE ability lands.
- **`onMoveStep` runner.** Hook signature still has `unknown` in its args. Land alongside the first movement-modifier consumer (forced-movement statuses, trap tiles).
- **Reaction limit reset point.** Today `reactionsUsedThisTurn` resets at the *reactor's* turn_start (zero is the initial value when CurrentTurn is built). Per turn-structure.md's open question, "reactor's own turn_start" is the right answer; double-check if session 8's Counter content surfaces edge cases.
- **`ProposedAction.source: 'system'` for non-system kinds.** Today Move/UseAbility/Wait/SetFacing have `source: ActionSource` (player or system). System reductions of those kinds aren't a v1 use case; flag if AI controllers want to commit player-shaped actions tagged as system for distinction.
- **Action log compaction.** For long battles the log grows unbounded. Replay needs it complete; session 8+ playtesting will surface whether memory is an issue. ADR territory if it does.
- **Cross-action determinism: same masterSeed + same proposed action sequence → same final state.** Action seeds derive from `(masterSeed, seq)` so replays are deterministic. Add an explicit determinism test (replay + compare states) when the first ability with damage variance ships.
