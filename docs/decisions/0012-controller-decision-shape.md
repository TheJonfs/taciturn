## ADR-0012: Controller decision shape (commit / end-turn / pending)

**Status:** Accepted
**Date:** 2026-05-03

## Context

Sessions 9 and 10 established the orchestrator pattern: each pump tick, the orchestrator asks the active unit's `Controller` for the next decision, and either commits an action or ends the turn. The session-10 `Controller` interface returned `ProposedAction | null`, where `null` meant "I have nothing to propose — end the turn." The greedy melee controller and a future AI controller fit cleanly into that shape.

Session 11 introduces a UI-driven controller. Player input is fundamentally push-driven — a click happens when it happens, and the orchestrator's pump runs every Pixi tick whether the user has clicked or not. This breaks the `ProposedAction | null` contract: returning `null` would commit a `turn_end` immediately every time the user is just thinking. The UI controller needs a third signal: "I have nothing yet — re-ask me later."

Decisions in scope:

1. **How the UI controller signals "still thinking."** Three reasonable shapes:
   - **(A) Async controller.** Change `Controller` to return `Promise<ProposedAction | null>`, so the UI can `await` user input. Cleanest at the call site, but ripples through the orchestrator's synchronous step loop.
   - **(B) Sentinel return value.** Keep `null` to mean "pending"; require all controllers to explicitly emit a `turn_end` ProposedAction when done. Existing greedy controller updates from `return null` to `return { type: 'turn_end', ... }`.
   - **(C) Discriminated decision union.** Replace the return type with `ControllerDecision = commit | end-turn | pending`. Greedy returns `end-turn`; UI returns `pending` while the queue is empty.

2. **How the wrapped commit case is shaped.** A bare `ProposedAction` has a `type` field but no `kind`, so a union of `ProposedAction | { kind: 'end-turn' } | { kind: 'pending' }` doesn't have a single shared discriminator. Either narrow with `'kind' in decision`, or wrap the action variant explicitly: `{ kind: 'commit'; action: ProposedAction }`.

3. **How the UI controller adapter exposes its imperative interface.** The hook needs to call something like `submit(action)`, `endTurn()`, `cancel()` from React. Three reasonable shapes:
   - Mutable singleton — anyone can submit.
   - Per-instance with explicit `cancel()`.
   - Per-instance, queue-based, multi-slot.

4. **What happens when the orchestrator's pump asks while the UI is pending.** Step returns empty committed array and `done: false`, pump retries next tick. Trivial — no decision needed beyond "don't commit anything."

## Decision

**Adopt the discriminated decision union (C1):**

```ts
export type ControllerDecision =
  | { readonly kind: 'commit'; readonly action: ProposedAction }
  | { readonly kind: 'end-turn' }
  | { readonly kind: 'pending' };
export type Controller = (state, catalog) => ControllerDecision;
```

The orchestrator's `step()` switches on `decision.kind`: `commit` runs `commitAction`, `end-turn` commits a `turn_end`, `pending` returns empty committed array without advancing the engine.

**Wrap the commit case explicitly** (`{ kind: 'commit'; action }` rather than a flat `ProposedAction` variant). The wrapper gives the union a single shared discriminator (`kind`) so TypeScript narrows cleanly without `'kind' in decision` checks. The cost — controllers say `return { kind: 'commit', action: {...} }` instead of `return {...}` — is six characters, paid once per call site, in exchange for unambiguous narrowing throughout the consumer code.

**`createUiController()` returns a single-slot adapter.** The adapter holds at most one queued decision. `submit(action)` enqueues a commit. `endTurn()` enqueues end-turn. `cancel()` clears the queue. `hasPending()` reports state. The internal `controller` function returns `pending` when empty and drains the slot otherwise. Submitting while a decision is queued throws — pile-ups are programmer errors that should surface loudly, not silently coalesce.

The single-slot constraint is intentional. The v1 UI flow is "pick a sub-action → wait for the engine to commit → ask for the next sub-action." The hook is responsible for not enqueueing a second decision until the first has drained (`hasPending()`). A multi-slot queue could be added later if a use case appears (rapid pre-input?), but it would obscure the natural rhythm of "decide, observe, decide again."

## Why

- **(A) async controller** would force the orchestrator's step loop into an async shape. The greedy controller and any future AI don't benefit from being async (they decide synchronously). Threading async through the pump just to accommodate one source of latency (UI input) is the wrong tradeoff — the pump already handles latency naturally by retrying each tick.
- **(B) sentinel value** works but reuses `null` for one of two semantically distinct cases ("done" vs. "thinking"). Forgetting to switch from "return null = end turn" to "return null = pending" mid-controller is the kind of bug that happens silently: the UI thinks it's waiting; the orchestrator ends the turn. The discriminated union makes that confusion impossible.
- **Wrapping the commit case** is the smaller of two evils. The alternative — relying on `'type' in decision` to pick the action variant — works but feels lawyerly. With three call sites in the orchestrator and a handful in the controllers, the explicit wrapper costs nothing meaningful and reads obviously.
- **Single-slot UI controller** matches v1's input shape. Multi-slot adds API surface (queue length, head/tail, ordering guarantees) for no payoff today.

## Notes / future edits

- The `pending` decision is observed by the orchestrator only. Future controllers (a network-driven one, for example) could plausibly use it to mean "RPC in flight" — the same shape composes.
- The UI controller's throw-on-double-submit is enforced by the adapter, not the hook. The hook's `useBattleUi` checks `hasPending()` before any `submit/endTurn` call to avoid hitting the throw path under normal use.
- If a multi-action submit ("queue Move + Attack as one user gesture") becomes a real workflow, the adapter grows a queue. The `Controller` interface doesn't need to change — multi-slot is a private concern of the adapter.
