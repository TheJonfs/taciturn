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

## From session 2026-05-06 (session 15: charged action lifecycle)

### Suggested next-session scope

Session 16 — Earth Mage (part 1). Per `docs/roadmap-sessions-14-20.md`: status application formula, status chance modifier hook, system actions for status side effects (per ADR-0017's "lands session 16" note), spec-driven reaction compiler (per ADR-0017), and Earth Mage's five non-AoE/non-Ultimate abilities (Base, Buff, Debuff, Reaction, Support) plus new status types (Regen, Move/Jump debuff & self-buff, Blind, Silence).

The session 15 substrate that session 16 inherits:

- **Charged-action lifecycle is fully shipped.** Earth's Base spell (charged TBD per ability spec) plugs into the existing `actionSpeed > 0` path in `reduceUseAbility`. Tile-anchored validation works; charged_action_resolve's full interruption matrix is in place.
- **Throwaway charged ability is `bolt`** (tile-anchored, magical damage, no status rider). Session 16's first real charged spell with a status rider (Earth's Base spell, if it ends up charged) is the first content consumer for the "charged + status rider" axis. The throwaway only exercises the damage path; the status-application axis on charged abilities needs explicit coverage when Earth's Base spell lands. **Add a status-rider charged-resolution test in session 16.**
- **Silence + Don't Act registration target.** `reduceChargedActionResolve` runs the caster's `onActionAttempted` chain at resolution. When Silence ships, its `onActionAttempted` handler (which already gates instant casts on `'voice'`/`'magical'` tags) automatically gates charged-spell resolution too — no additional engine work. Same for Don't Act. The handler can read the synthesized `incomingAction.payload.abilityId` to look up the ability's tags.
- **Charging `customState.chargedActionId` is in place** for future hook content. A "perfect-hit-on-Charging" passive or a "counter-spell" ability targeting the ChargedAction by id can read the pointer when it ships. v1 has no consumers; the field is there for future content.
- **Engine-side `turn_end` on active-unit KO is the default behavior.** ADR-0013's orchestrator guard is gone. Any caller of `commitAction` inherits the auto-emit. AI / UI / future replay drivers don't need their own guard.

### Things noticed during the session

- **Throwaway `bolt` exercises only the damage path of charged resolution.** Tile-anchored magical damage covers tile validation + magical pipeline + FFT-pinning-to-tile + Charging lifecycle. It does *not* exercise:
  - Status-rider on charged spells (the `effects.statusEffects` path inside `resolveAbilityEffect`).
  - Unit-anchored charge (FFT pinning to a unit by id, even after they move).
  - Self-targeted charged abilities (today `buildTargetRefs` throws for `'self'` targeting on charged paths — no v1 content does this; the throw is the deliberate shape).
  - Charge fizzling on KO'd unit target (single-unit anchor).
  - Multi-target charged AoE (lands session 17 alongside per-target dispatch).

  Session 16 should add tests for **status-rider charged resolution** (Earth's Base spell, if charged) and **unit-anchored FFT pinning** (any single-target charged spell would do — Earth's Buff if charged, otherwise constructed).

- **`makeChargedAction` test fixture defaults `abilityId: 'fireball'`** — a non-existent id. Tests that use it through `reduceChargedActionResolve` need to pass an explicit `abilityId` matching a real ability in the catalog. Existing CT projection / speed tests don't go through the resolve reducer so the default works for them. Worth flagging if a session 17 test bumps into it.

- **`reduceUseAbility` decrement-act-budget behavior for reactions.** Pre-existing carry from earlier sessions: when a reaction's `reduceUseAbility` runs, it decrements `actsAvailable` from the *active unit's* turnState, not from the reactor's (since reactions fire during another unit's turn). This is silently wrong arithmetic but unhittable in v1 (default budget is 1; reactions don't gate on `actsAvailable` anyway because the reaction path skips the budget check in validation). Worth noting for the day a multi-action turn budget ships.

- **`AbilityTarget.kind: 'tile'` is reachable from any path that builds a UseAbilityPayload.** The instant tile-anchored case is now also wired through `resolveAbilityEffect` (no `'tile'` targeting consumer in v1 abilities ships outside of charged Bolt, but the path is there). When Earth's AoE lands in session 17 with tile-anchored AoE, the AoE per-target dispatch grows out of `resolveAbilityEffect` into a per-target loop with seed branching.

- **Stop-pause edge case: Quick pushes a paused charge's CT past 100.** Documented in `engine/ct/speed.ts` and ADR-0023. No v1 ability targets ChargedActions for CT push, so the case is unhittable. When such content ships (likely Time Mage or similar in wave 2), the scheduler may need to suppress the "advanceable: ct >= threshold" branch for paused entities, or the `paused` flag re-enters as a stored field. Defer.

- **Charging stacking is REJECT.** A second UseAbility with `actionSpeed > 0` on a unit who's already charging would reject at the stacking pipeline. In practice, validateAction rejects first (the caster's turn is being skipped, no `actsAvailable`), so REJECT is the backstop. If "double-cast" content ships later, Charging's stacking rule is the place to change.

### Things considered but did not do

- **Stored `paused` flag on ChargedAction synced via Stop apply/remove.** Per the design doc and the original 14→15 handoff, Stop pause was specified as a stored flag. Pivoted to a derived read at projection time during the session 15 plan. Rationale captured in ADR-0023 ("Alternatives considered"). The Quick-pushes-paused-charge edge case is the one shape the flag would have handled cleanly; the derived approach defers that case until a content consumer surfaces it.

- **Hardcoded `statusTypeId('charging')` in the engine.** Considered as the simplest implementation of "engine applies Charging." Rejected per ADR-0023: the engine is otherwise content-free; a hardcoded content reference would break the pattern. The ruleset entry is a small, parallel surface to the existing damage-handler refs.

- **Per-action `turn_end` checkpoint** (instead of post-chain) for the engine-side KO auto-emit. Rejected per ADR-0023: a per-action check would re-fire after every committed reaction in a chain that kills the active unit, generating spurious turn_ends. The post-chain checkpoint is the natural seam.

- **Removing the controller-level `decideBasicAi` defensive HP <= 0 check.** Could be removed now that the engine handles it. Kept as cheap insurance and so the AI is honest as a standalone library — a caller using `decideBasicAi` outside the demo orchestrator still gets a sane answer. Trivial to remove if it ever becomes load-bearing in a confusing way.

- **Status-rider on the throwaway `bolt` ability.** Considered: a Bolt that applies a Slow-style status would exercise the status-application axis on charged spells in addition to the damage axis. Rejected: would require introducing a new status type as session 15 throwaway scope, blurring the line with session 16's status-content work. Bolt stays damage-only; session 16's Earth content lights up the status-rider-on-charged axis with proper status types.

### Open questions for later sessions (not blocking)

- **Should Charging also gate a unit's own turn via `onActionAttempted` rather than `queryTurnSkipped`?** Today a Charging caster's turn_start emits a turn_end via the skip query. This means the caster's per-unit-CT statuses don't tick on the skipped turn (Stop's pattern). If the design wants per-unit-CT statuses to *keep ticking* during charge (so a Poison'd Mage continues to take damage while charging), Charging should switch to a different mechanism. The current behavior matches Stop, which is probably correct, but worth confirming when the first poisoned-Mage scenario arises.

- **MP refund-on-cancel for charged spells.** ADR-0023 states no refund per BMG. If a future ability targets a ChargedAction in the queue and "cancels" it (via a Dispel-style effect), should the caster's MP refund? Current architecture: no — the cancel path would just remove the ChargedAction + Charging without reversing MP. If the design wants refund-on-cancel-but-not-on-fizzle, it's a one-line policy in whatever content consumer cancels charges. Surface in session 17/18 if such an ability lands.

- **`isReaction` behavior on charged-action-resolve.** Today the `resolveAbilityEffect` helper passes the synthesized `incomingProposed` action as a normal use_ability ProposedAction (no isReaction flag). Reactions (Counter etc.) trigger normally on a charged-action's damage. Worth checking the design intent: is a charged-spell-target's Counter a "reaction to a magical spell" (allowed) or "a reaction to a system action" (suppressed)? Today's behavior is the former, which feels right per BMG ("Magical reactions" in session 20's scope), but worth a sanity check when session 20's Lightning Reaction ships.

- **What happens if `applyStatus` for Charging is rejected** (e.g., resistance kicks in, or REJECT stacking fires because of an existing Charging instance)? Today `commitCharged` does not check the apply outcome — the ChargedAction is still pushed regardless. If Charging fails to apply, the caster has an orphan ChargedAction with no Charging status. v1 has no path that would actually cause this (no resistances, REJECT is unreachable per validation). Worth a defensive check / explicit error if a future session can reach the case.

### Notes for future ADRs

- ADR-0014 (equipment integration deferred to session 17) lands its companion ADR when session 17 implements equipment. The post-session-17 ADR can reference ADR-0023's `RulesetChargedActions` pattern as a precedent for "subsystem-config on the ruleset" if equipment-on-ruleset becomes a question.

- ADR-0017 (system actions for status side effects, deferred to session 16) lands its companion ADR when session 16 implements the action-emission slot on hook handlers and the `status_remove` / `status_decrement_stack` system actions. The companion can reference ADR-0023 as a precedent for "engine-defined system actions that drive status lifecycle" — Charging is removed via direct `removeStatus` call inside the resolve reducer, not via a system action. If session 16 wants to unify that path through `status_remove`, the change is local to `finalizeResolution` in `reducers.ts`.
