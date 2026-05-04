## ADR-0013: Mid-turn KO of the active unit — orchestrator-side defensive guard

**Status:** Accepted (provisional)
**Date:** 2026-05-03

## Context

Session 13 added Counter to the demo loadout. The first 2v2 integration run surfaced a real failure mode that prior 1v1 content never produced:

1. The active unit (call them A) proposes an attack against unit B.
2. The damage pipeline applies HP loss to B and fires `onActionTargeted`. B's Counter passive queues a counter-attack against A.
3. The orchestrator commits the counter-attack as a generated reaction. The damage pipeline applies HP loss to A and fires `onActionTargeted` against A. A's Counter queues a counter-counter against B.
4. After the chain of counter-fire settles, control returns to A's turn — but A is now KO'd by the counter-attacks.
5. The orchestrator's pump asks A's controller for the next decision. The AI controller doesn't check the actor's HP, sees enemies on the field, and proposes a Move. `validateAction` rightly rejects it: `"Unit '<id>' is KO'd and cannot act"`. The orchestrator throws.

The bug applies to any controller — UI, greedy, AI — because none of them check that their actor is still alive before proposing an action. Each had its own "filter living enemies" logic but treated the actor as implicitly alive.

Three layers can hold the fix:

1. **Engine.** `commitAction` could automatically emit a `turn_end` as a generated action when its action chain leaves the active unit KO'd, parallel to how the Stop status emits a `turn_end` when its `queryTurnSkipped` hook fires at turn_start.
2. **Orchestrator.** Before asking the controller for a decision, check whether the active unit is KO'd; if so, force a `turn_end` directly.
3. **Per-controller.** Each controller checks `actor.vitals.hp > 0` and returns `end-turn` if not.

## Decision

**Adopt the orchestrator-side guard (option 2) for session 13.** Defer the engine-side auto-emit (option 1) to a later session.

The orchestrator's `step()` checks the active unit's HP after fetching it from state. If `actor.vitals.hp <= 0`, it commits `turn_end` directly without consulting the controller. The fix is centralized — any controller registered with the orchestrator inherits the protection, and the controllers themselves stay naive about KO state.

Rationale for orchestrator-side:

- **One place handles the case for all controllers.** Per-controller checks (option 3) spread the same five-line guard across every controller, and a future controller has to remember to add it.
- **Doesn't conflate "what should I do?" with "should I act at all?"** Controllers answer the former; whether the actor is even fit to consider acting is upstream.
- **Smallest possible change.** No new actions, no new hook, no engine-policy change. The orchestrator already owns the decision loop.

Rationale for deferring the engine-side fix:

- The engine-side change is a real policy decision with surface area: when *exactly* should the auto-`turn_end` fire? After the root action's chain settles? After every action? What about a unit that gets KO'd by their own self-targeting effect (none today, but plausible later)? What about charged-action resolution by a KO'd unit?
- Session 13 is content+integration, not engine policy. Promoting this fix to the engine warrants its own session.
- The orchestrator-side guard is forward-compatible: when the engine-side fix lands, the guard becomes redundant but harmless (the engine would have emitted `turn_end` first; the orchestrator's check finds an empty `turnState`).

The defensive control-side check inside `decideBasicAi` was also kept (`if (actor.vitals.hp <= 0) return END_TURN`), as cheap insurance and so the AI is honest as a standalone library — a caller who uses `decideBasicAi` outside the demo orchestrator still gets a sane answer.

## Consequences

- The orchestrator's `step()` has one new branch: KO'd active unit → emit `turn_end`.
- The bug surfaced in session 13's 2v2 integration test is fixed; all 345 tests pass.
- The engine still has an open policy gap: a hypothetical future caller who drives `commitAction` outside the demo orchestrator (a different scheduler, an alternate orchestrator) does not inherit the guard. They'd hit the same bug. This is acceptable while the demo orchestrator is the only consumer; when a second consumer ships, the engine-side auto-emit becomes load-bearing and gets promoted.
- The handoff doc carries the engine-side auto-emit forward as candidate scope for a future session, alongside related "post-action checkpoint" items (battle-end checkpoint on damage-application, `reaction_fizzled` system event).

## Alternatives considered

**Engine-side auto-emit `turn_end`.** Right answer long-term; deferred for the policy-surface reasons above. Track it as an open scoping question for a dedicated engine session.

**Per-controller checks only.** Rejected — see "spread across every controller" above. The defensive `decideBasicAi` check we *did* add is belt-and-suspenders, not the primary fix.

**`validateAction` returning a sentinel that the orchestrator special-cases.** Rejected as a hack: validateAction's contract is "is this action legal," not "does this signal something the caller should react to."

## References

- The orchestrator's guard: `src/app/demo/orchestrator.ts` (`step()`, the `actor.vitals.hp <= 0` branch).
- Reaction fizzle (orchestrator silently drops invalid mid-chain reactions): see ADR-0011 ("Turn flow") and `src/engine/actions/commit.ts`.
- Stop status's parallel "skip turn → emit turn_end" pattern: `docs/design/turn-structure.md` and ADR-0011.
