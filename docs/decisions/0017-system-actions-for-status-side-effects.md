## ADR-0017: System actions for status side effects

**Status:** Accepted (deferred implementation — lands session 16)
**Date:** 2026-05-06

## Context

Several v1 status mechanics need a status to react to an event by changing itself:

- **Sleep** wakes when its bearer takes damage. The `onDamageReceived` hook fires, and the Sleep status needs to *remove itself*.
- **Burn** (session 19) deals damage when its bearer's CT reaches 100, then *decrements its stack count*. When stack count reaches 0, it removes itself.
- **Vulnerable** (session 20) multiplies the next incoming damage, then *removes itself* (one-shot consumed).

Today the hook system is read-only with respect to state: handlers compute return values (modifyStatQuery → number, onActionTargeted → reactions list) but cannot mutate status state directly. CLAUDE rule 2 forbids in-place state mutation; rule 3 says all state changes go through the reducer as Actions.

The reconciliation report (item 1.3) flagged this: there's no v1 mechanism for "status responds to event by changing itself." Three options surfaced:

1. Hook handlers return a special "removeSelf" sentinel (per-hook ad-hoc).
2. Hook handlers gain an optional `emittedActions: SystemAction[]` return field — the engine processes these through the reducer after the parent action completes.
3. Add a dedicated `onWake` predicate hook for each self-removing status pattern.

## Decision

**Hook handlers gain an optional `emittedActions: SystemAction[]` return field. The engine appends emitted actions to the action chain, processed through the reducer after the parent action completes.**

The general shape (final form lands in session 16):

```typescript
// Existing per-hook return type wraps in a structure that includes emissions.
// E.g., onDamageReceived's return becomes:
type OnDamageReceivedReturn = {
  ctx: DamageContext;            // existing return
  emittedActions?: SystemAction[]; // new optional field
};
```

(Exact shape — whether the wrapper is per-hook, a uniform wrapper, or a side channel — is an implementation detail to settle in session 16 when the first consumer ships. The architectural commitment is "hook handlers can emit system actions; emissions go through the reducer.")

Two new system action types accompany this:

- `status_remove`: removes a named status from a target unit. Idempotent (no-op if the status isn't present).
- `status_decrement_stack`: decrements stack count on a named status; if count reaches 0, removes the instance.

Reducers for both write to `state.units[id].statuses` immutably and fire `onRemove` hooks where appropriate. Both action types are system actions (no actor; emitted by the engine, not by player input).

## Rationale

**Why not the "removeSelf" sentinel approach.** A per-hook sentinel works for self-removal but doesn't generalize. Burn needs to *decrement* (not remove); Vulnerable needs to remove *self*; Sleep needs to remove *self*. Each variation would need its own sentinel and per-hook logic to interpret it. Adding a hook surface for "side-effect emission" is the unified mechanism — it scales to any status state change without per-pattern engine code.

**Why not a dedicated `onWake` predicate.** Sleep is one of three current consumers, and only one of them is naturally named "wake." Burn's CT-100 trigger isn't waking; Vulnerable's consume-on-damage isn't waking. A pattern-by-pattern predicate hook means three new hooks, one per status. The emit-system-action mechanism is one new pattern that handles all three.

**Why this respects CLAUDE rule 2 ("state changes through the reducer").** Hook handlers don't mutate state directly. They return data — including emissions, which are *proposed actions*. The engine processes those through the reducer exactly like any other action. This preserves the action log's role as the canonical history (replay walks the log; status removals show up as `status_remove` entries, not as silent side effects).

**Why this respects CLAUDE rule 3 ("Actions are the unit of state transition").** Status removals and stack decrements become real Actions in the log. Replay reconstructs them deterministically. Debug overlays / future log viewers can render them.

**Why this respects CLAUDE rule 8 (closed hook surface).** No new hooks; existing hooks gain an optional emissions side channel. The closed list of hook *names* doesn't grow; the *return shape* of those hooks evolves to support emissions.

## Implementation note

**Land the infrastructure in session 16, alongside Earth Mage.** Earth Mage's status-applying spells don't directly need the side-effect mechanism, but the broader Earth content (Buff applying Regen, Debuff applying multi-status combos) is when the engine has the most pressure on `applyStatus` and `removeStatus` paths. Building the side-effect machinery alongside the broader status work keeps the changes coherent.

Specific consumers per session:
- **Session 16 (Earth Mage):** infrastructure lands. Earth Mage may not directly use it; Sleep can be backfilled to use it as a regression check.
- **Session 19 (Fire Mage / Burn):** Burn uses `status_decrement_stack` on CT-100 trigger.
- **Session 20 (Lightning Mage / Vulnerable):** Vulnerable uses `status_remove` on damage-consumed.

## Consequences

- **Two new system action types in the reducer:** `status_remove`, `status_decrement_stack`. Each has its own reducer that produces a new `GameState` with the status removed / stack decremented. Reducers are pure given `(state, action, seed)` per CLAUDE rule 7.

- **Hook handler return shape evolves.** The exact shape (uniform wrapper vs per-hook) is a session-16 implementation choice. The architectural commitment is just that emissions are possible.

- **Existing handlers don't change immediately.** Until session 16 lands the infrastructure, no handler emits actions. The plan is to land the shape change with a no-emit default — existing handlers either don't return the field or return an empty array.

- **The action chain's emission slot grows.** Today `commitAction` processes `generatedActions` (system events) and `generatedReactions` (response actions). When this lands, hook-emitted actions enter via a third source — though the chain processor handles them with the same FIFO discipline.

- **Sleep's eventual implementation has a clear model.** Sleep registers `queryTurnSkipped` (returns `{ reason: 'asleep' }`) and `onDamageReceived` (returns `{ ctx, emittedActions: [{ type: 'status_remove', target: self, statusType: 'sleep' }] }`). The asleep unit skips its turn until damage wakes it.

- **Burn's eventual implementation is a custom-trigger consumer of the same pattern.** Burn's CT-100 trigger runs damage through the pipeline, then emits a `status_decrement_stack` for itself. When stacks reach 0, the decrement reducer removes the instance.

- **Sleep doesn't need to ship in 13.7.** This ADR documents the architectural decision; the actual plumbing lands when the first consumer needs it (session 16). 13.7 only writes the ADR.

## Alternatives considered

**Statuses ship a "self-mutator" function instead of emitting actions.** Rejected — bypasses the reducer, breaks replay determinism, makes the action log incomplete. Side effects that don't produce log entries are exactly what CLAUDE rule 3 forbids.

**A dedicated `onWake` hook per pattern.** Rejected — three hooks for three patterns is more engine surface area than one mechanism that handles all three.

**Synchronous status removal inside the parent action's reducer.** Rejected — the parent action's reducer would need to know about every status's self-removal logic. Couples the engine to specific status types, which CLAUDE explicitly rejects.

**Run emitted actions inline (within the same reducer call) rather than as separate chain entries.** Rejected — hides the side effects from the action log. Replay would re-run them inline on rerun, but a debugger walking the log wouldn't see them as discrete events.

## References

- `docs/design/status-effects.md` — hook system overview.
- `src/engine/hooks/hooks.ts` — current hook signatures.
- `src/engine/actions/reducers.ts` — current reducer dispatch.
- ADR-0011 — chain processing pattern that emitted actions feed into.
- Reconciliation report item 1.3.
