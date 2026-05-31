## ADR-0023: Charged action lifecycle, Charging status, Stop pause, and engine-side turn_end on KO

**Status:** Accepted
**Date:** 2026-05-06

**Supersedes:** ADR-0013 (the orchestrator-side mid-turn-KO guard).

## Context

Session 15 implements the charged-action lifecycle: the actionSpeed > 0 path in `reduceUseAbility`, the paired Charging status, the `'tile'` TargetingSpec validation, the `charged_action_resolve` reducer with its full interruption matrix per the Battle Mechanics Guide, and the engine-side `turn_end` auto-emit on active-unit KO that ADR-0013 deferred to "a later session."

Decisions in scope:

1. **How the engine references the Charging status type.** Hardcoded id, ruleset parameter, content-defined hook coupling, or something else.
2. **How Stop pauses an in-flight charge.** A stored `paused` flag synchronized via Stop's apply/remove handlers, or a derived read at projection time.
3. **What hook surface Charging registers.** Only `queryTurnSkipped`, or also a counter-spell / perfect-hit-on-charging hook scaffold.
4. **What happens at resolution time when the caster is interrupted.** When does the charge fizzle vs. resolve? What hook chain enforces it?
5. **How the engine-side `turn_end` on active-unit KO fires.** Per-action checkpoint, post-chain checkpoint, or another shape.
6. **Tile validation surface.** What does the `'tile'` TargetingSpec branch of `validateAction` check?
7. **Throwaway charged ability shape.** Magical damage tile-anchored, status-only, or both.

## Decision

**Charging status is named on the ruleset, not hardcoded in engine code.** `RulesetChargedActions.chargingStatusTypeId: StatusTypeId` carries the v1 default `statusTypeId('charging')`. The engine's `reduceUseAbility` reads the id from the active ruleset and applies the named status to the caster at commit. An alternate ruleset could ship a differently-named or differently-behaving "charging" effect (e.g., a "Quickdraw" mode where Charging doesn't skip turns) without touching the reducer. The pattern parallels how the ruleset already names damage handler refs and source tiers.

**Stop pause is derived, not stored.** `computeActionSpeed(state, action, catalog)` returns 0 when the caster has any status listed in `RulesetChargedActions.pausingStatusTypeIds`. v1 lists only Stop; Sleep / Petrify will join when those statuses ship. The projection queue and the scheduler treat speed=0 entities as non-advanceable, so a paused charge sits at its current CT until the pause clears. No side-effect mutation happens in Stop's apply/remove handlers, which is a notable architectural win — `fireOnApply` / `fireOnRemove` don't take state and shouldn't have to. Reading state-derived fields on every projection call is cheap (small status lists, small charged-action lists) and removes a synchronization invariant.

**Charging registers `queryTurnSkipped` only in v1.** The handler returns `{ reason: 'charging' }`, mirroring Stop's pattern. The caster's own turn_start short-circuits to a turn_end. Future content (e.g., perfect-hit-on-Charging targets, counter-spelling abilities) can register additional handlers without engine work — the hook surface is already source-agnostic. The status carries a `customState: { chargedActionId }` pointer so future hooks can read which charge they pair with. Stacking rule is REJECT (a single caster has at most one charge in flight in v1; validation already rejects a second UseAbility because the caster is being skipped, REJECT here is the backstop). Duration mode is `'conditional'` — the lifecycle is driven entirely by `charged_action_resolve` removing it.

**Resolution-time interruption goes through `onActionAttempted`.** `reduceChargedActionResolve` synthesizes a `ProposedAction` reflecting the caster + ability + first target, then runs the caster's `onActionAttempted` chain. A `'blocked'` result fizzles the charge silently; ChargedAction and Charging are still cleaned up. v1 has no `onActionAttempted` consumers that gate on charged-spell tags (Silence / Don't Act ship in session 16). The wiring is in place so those statuses register a single handler that vetoes both instant casts and charge resolutions. Caster KO is checked before this hook chain — a KO'd caster fizzles by short-circuit, not by hook contribution. Stop never reaches this reducer (paused charges don't trigger).

**Target validity checks per BMG: caster KO fizzles, single-unit-target KO fizzles for that target, tile-anchored resolves regardless.** `resolveTargetAtResolve` resolves each `TargetRef` to a `Unit | null` at resolution time. Unit refs use FFT pinning (the unit's id is canonical even if they moved); tile refs look up `unitAt` at the position. KO'd unit-target → that target fizzles silently. Empty tile → resolution lands but applies no per-target effects (no damage, no reactions). Out-of-range single-unit target still resolves (FFT pinning). The MP cost stays committed in all cases.

**Engine-side `turn_end` on KO is a post-chain checkpoint in `commitAction`.** After the action chain drains, the function checks `shouldAutoEndTurn(state)`: if `turnState !== null` and `outcome === undefined` and the active unit is KO'd, it appends a `turn_end` ProposedAction to the queue and re-enters the loop. The auto-emitted `turn_end` may itself emit further system actions (status_tick fan-out, battle_end); those drain through the same loop. The check fires only after the root action's chain has fully settled — it is *not* a per-action checkpoint. This matches the design intent "the active unit dying mid-chain unwinds cleanly at the end" without interrupting the chain or short-circuiting reactions partway through. It's also the natural place: a per-action check would re-fire after every committed reaction in the same chain, generating spurious turn_ends.

**This supersedes ADR-0013.** The orchestrator-side defensive guard introduced in session 13 is removed: `DemoOrchestrator.step` no longer checks the active unit's HP before consulting the controller, because by the time the orchestrator next reads turnState the engine has either auto-ended the turn (turnState null) or the active unit is alive. The controller-level check inside `decideBasicAi` stays as cheap insurance and to keep the AI honest as a standalone library.

**Tile validation: tile exists, tile in range, rangeMode-specific check (LoS for `'straight_line'`, arc-coverage for `'arc'`, no extra check for `'melee'`).** The validation mirrors the unit-target case but reads source/target elevations from the tiles directly rather than from the resolved unit. Mismatched targeting kind (e.g., a tile-anchored ability fired at a unit) returns invalid with a "requires a tile target" reason.

**Throwaway charged ability is `bolt`: tile-anchored, magical damage, no status rider.** Lives in `src/content/abilities/bolt.ts` alongside a placeholder `arcane_skill` command set. Tile targeting exercises the `'tile'` validation; magical damage exercises the session-14 magical pipeline. No status rider keeps the throwaway scope tight — session 16's Earth Mage abilities are the first real charged spells with status riders. Numbers are placeholder (power 5, mpCost 8, actionSpeed 25); real spell tuning is per-class in 16+.

## Consequences

- **The engine has one new ruleset-driven concept (`chargedActions`) and one new derived stat read (caster-pause check inside `computeActionSpeed`).** Both are tightly scoped to the charged-action subsystem; no other engine reads thread through them.

- **`computeActionSpeed`'s old contract ("returns the field, floored against the speed bound") is now: "returns the field, floored, *and* zeroed when the caster has a paused-by status."** Callers don't need to know the difference — projection / scheduler / future Hasten-Charge consumers all see the right effective speed. The old behavior is recoverable by calling `computeActionSpeed` with a ruleset whose `pausingStatusTypeIds` is empty.

- **`reduceUseAbility` is now a thin orchestrator over `commitCharged` (charged path) and `resolveAbilityEffect` (instant path's effect application).** The shared `resolveAbilityEffect` is also reused by `reduceChargedActionResolve` for the per-target body, so damage-pipeline / status-apply / reaction logic is in one place. AoE per-target dispatch in session 17 will land as another caller of `resolveAbilityEffect` with seed-branching per target.

- **`commitAction` has a new post-chain loop branch.** When the queue drains and the active unit is KO'd, the function appends a `turn_end` and re-enters. Static analysis: the loop terminates because each iteration either commits something (which reduces the queue) or the post-condition (`shouldAutoEndTurn`) becomes false (turnState becomes null after the auto-emitted turn_end commits). No path can re-add a turn_end after one has already drained turnState.

- **ADR-0013's orchestrator-side guard is removed.** The orchestrator's `step()` no longer special-cases KO'd active units. Any caller of `commitAction` (replay-driven, networked, headless) inherits the engine-side behavior. The controller-level `decideBasicAi` defensive return for HP <= 0 stays — it's belt-and-suspenders and lets the AI behave correctly as a standalone library.

- **Stop never reaches `reduceChargedActionResolve` in v1.** With Stop pausing CT accumulation via the derived speed read, the scheduler doesn't pick a paused charge as the next event. The reducer's KO-and-onActionAttempted check is ordered correctly for the day Stop's behavior changes (e.g., a future ruleset variant that fires Stopped charges anyway).

- **Edge case noted in code: Quick-style ability pushing a paused charge's CT past 100 would still trigger.** No v1 ability targets ChargedActions for CT push, so this is unhittable. When such content ships, the scheduler may need to suppress the triggered-but-paused case (the design doc's `paused` flag would re-enter the picture). Documented in `engine/ct/speed.ts` and the ruleset comment.
  - **Resolved (S55).** A sibling of this case *was* hit in playtest without any CT-push content: a charge accumulates to CT ≥ 100 normally, then Stop lands (e.g. a second Shadow Stitch) the tick before resolution. The charge had already crossed the threshold, so the scheduler's `ct >= TRIGGER_THRESHOLD` candidate filter picked and resolved it despite the caster now being paused — violating this ADR's own invariant ("Stop never reaches this reducer — paused charges don't trigger"). Fix: both the runtime scheduler (`engine/turn/scheduler.ts`) and the projection (`engine/ct/projection.ts`) now exclude a paused charged action (`computeActionSpeed` ≤ 0) from *both* the advanceable set and the trigger candidates, so it freezes at its CT until the pause clears, then resolves. Units are untouched (a Stopped unit still triggers-and-skips via `queryTurnSkipped`). This also covers the original Quick-push variant.

- **Tile validation throws "not yet implemented" no longer applies.** Authors writing a tile-anchored ability today get full validation coverage. Session 17's per-target AoE dispatch reuses the same tile-anchor validation for the AoE's anchor; the per-target unit dispatch happens inside the resolve reducer (as `resolveAbilityEffect` per target).

- **Throwaway scope discipline:** session 16 will need to test status-rider charged abilities (Earth Mage's debuff or buff casts at non-zero actionSpeed). The session 15 throwaway exercises only the damage path; the status-application axis is covered by existing session 14 status tests for instant abilities and re-exercised in session 16 with a charged consumer. Carried in handoff.

## Alternatives considered

**Hardcoded `statusTypeId('charging')` in the engine.** Rejected: the engine is otherwise content-free (it reads damage handler refs, source tiers, etc. from the ruleset) and a hardcoded content reference would break that pattern. The marginal complexity of the ruleset entry is small.

**`paused: boolean` field on ChargedAction synced via Stop's apply/remove.** The design doc and the original session 14→15 handoff both specified this shape. Rejected during the session 15 plan in favor of the derived approach because (a) `fireOnApply`/`fireOnRemove` handlers can't return state changes, so synchronization would have to live outside the hook (in `applyStatus` / `removeStatus` itself), spreading "Stop knows about charged actions" across the engine status pipeline; (b) the derived approach reads state-of-the-world on every projection, which is cheap and removes the invariant. The Quick-pushes-paused-charge edge case is real but unhittable in v1; documented for the day a content consumer surfaces it.

**Per-action `turn_end` checkpoint instead of post-chain.** Considered: fire the auto-emit after every committed action in the chain. Rejected: a Counter chain that kills the active unit *and* still has queued reactions would emit `turn_end` before the queued reactions fire, interrupting the chain. The post-chain checkpoint is the natural seam — chain settles, then the engine looks at world state and decides "is the active unit fit to keep going?"

**Resolution-time interruption via a new dedicated hook (`onChargeAttempted`).** Considered: define a new hook for "the caster is about to resolve this charge — should it fire?" Rejected: `onActionAttempted` already has the right shape. A new hook would force every Silence-style status to register two handlers (one for instant, one for charged), with identical logic. The synthetic ProposedAction at resolution time costs nothing.

**Unit-anchored charged ability as the throwaway.** Considered: a unit-target charged spell would exercise FFT pinning more naturally (the target moving doesn't change the spell's destination). Rejected: tile-anchored exercises both the `'tile'` validation surface and the resolve-time `unitAt` lookup, which is more leverage on the engine work session 15 is doing. Unit-anchored charged spells will appear with real Mage class content in 16+.

## References

- `src/engine/types/charged-action.ts` — ChargedAction shape (unchanged from session 1).
- `src/engine/actions/reducers.ts` — `reduceUseAbility` charged path (`commitCharged`), `reduceChargedActionResolve`, `resolveAbilityEffect`.
- `src/engine/actions/commit.ts` — post-chain auto-emit (`shouldAutoEndTurn`).
- `src/engine/actions/validate.ts` — `'tile'` validation branch.
- `src/engine/ct/speed.ts` — `computeActionSpeed` derived pause read.
- `src/engine/types/ruleset.ts` — `RulesetChargedActions`.
- `src/content/statuses/charging.ts` — Charging status definition.
- `src/content/abilities/bolt.ts` — throwaway charged ability.
- `src/content/command-sets/arcane-skill.ts` — placeholder Arcane Skill command set.
- `src/app/demo/orchestrator.ts` — orchestrator with the ADR-0013 guard removed.
- `docs/battle-mechanics-guide.md` — interruption rules, MP timing, target-validity policy.
- ADR-0013 — superseded by this ADR.
- ADR-0011 — turn flow context (battle-decided guard, scheduler).
