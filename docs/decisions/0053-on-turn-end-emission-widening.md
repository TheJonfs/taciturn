# ADR-0053 — `onTurnEnd` emission widening: state in args, OnTurnEndResult in return

**Status:** Accepted (Session 26, 2026-05-11)

**Context.** Quickstep (Lightning Mage's Movement-bucket passive, session 26 content) needs to fire at turn-end and emit a `system_ct_push` against the unit when a Move action was committed during the turn. The trigger is "this unit ended a turn after moving"; the effect is "push CT forward by MA."

Pre-26, the `onTurnEnd` hook had a narrow signature:

```typescript
onTurnEnd: {
  args: { unit: Unit };
  return: void;
};
```

Two problems for Quickstep:

1. **No `state` in args.** Quickstep gates on `state.turnState.consumed.movesConsumed > 0`. Without state in args, the handler can't read it.
2. **Return `void` — no emissions.** Quickstep needs to emit a `system_ct_push` follow-on action. The hook surface offered no way to attach emissions to the turn-end lifecycle event.

Additionally, the hook was *declared but never fired* pre-26: no runner existed and no reducer dispatched it. Session 9 (per the comment in hooks.ts) reserved the slot but never wired it. So this session adds the runner + dispatch alongside the signature widening.

Three v1+ consumers will benefit from the widened shape:

1. **Quickstep** (this session) — Move-committed CT refund.
2. **Future "stamina" / "regeneration" passives** that need to emit healing or status applications at turn boundaries.
3. **Equipment with "end-of-turn" procs** (Cluster 5 territory) — similar pattern to Flow State but on turn boundary.

**Decision.** Two-part widening:

**1. Hook signature.** Match the pattern established by `onTick` (which already takes `state` + `catalog` in args) and `onActionResolved` (which already returns an `emittedActions` wrapper):

```typescript
export interface OnTurnEndResult {
  readonly emittedActions?: ReadonlyArray<ProposedAction>;
}

onTurnEnd: {
  args: { unit: Unit; state: GameState; catalog: Catalog };
  return: OnTurnEndResult | void;
};
```

- `state` is the *pre-turnState-clear* state (the runner is called before `reduceTurnEnd` clears `turnState`), so handlers see `consumed.movesConsumed`, `consumed.actsConsumed`, etc.
- `catalog` is in args so handlers can run `runModifyStatQuery` for stat-based emissions (Quickstep queries MA).
- Return is `OnTurnEndResult | void` — the runner normalizes `undefined`-return to "no emissions." `void` is preserved so future void-returning handlers (telemetry, debug-only sinks) don't need to invent an empty wrapper. Quickstep returns `{ emittedActions: [] }` for the early-out paths and `{ emittedActions: [refund] }` for the emit path; explicit narrowing avoids the TS strict-mode `void` vs `undefined` distinction.

**2. Wire-up.** Add `runOnTurnEnd` to `engine/hooks/runners.ts` mirroring `runOnTick`'s emission-collection shape:

```typescript
export function runOnTurnEnd(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): ReadonlyArray<ProposedAction> {
  // Collect handlers, fire each, gather emittedActions flat.
}
```

Fired from `reduceTurnEnd` between `newUnit` construction (post-CT-decrement) and `turnState: null` clear. The intermediate state (`withUnit(state, newUnit)`) is passed to handlers — they see the unit's CT post-decrement, and `state.turnState.consumed` is still populated. Emissions are appended onto the existing `generated: ProposedAction[]` queue, alongside the duration-tick emissions for turn-based statuses. Battle-outcome evaluation runs after, unchanged.

**Consequences.**

- **`onTurnEnd` becomes a first-class emitting hook.** Quickstep's CT refund is the first consumer; any future "end-of-turn effect" passive / status / equipment will reuse the shape without further engine change.
- **Handler-visible state is the pre-clear state.** `state.turnState` is non-null inside the handler. After the reducer continues, `turnState` is cleared and emissions process in chain. Consumers reading state in emitted-action context need to remember that turn-state is now null.
- **`onTurnStart` not widened symmetrically.** Pre-26 `onTurnStart` is also void-return; no v1 consumer needs to emit at turn start yet. Symmetric widening is a one-line follow-up when the first consumer lands.
- **No legacy void-returning handlers exist** (the hook was declared-but-unfired pre-26), so the `void | OnTurnEndResult` union is forward-compatible without any existing code path to migrate. The union is preserved as a forward-compatibility nicety: future telemetry-style handlers can use bare `void` returns.
- **Test fixtures with void-returning handlers stay valid.** The `on-turn-end-emit.test.ts` `sideEffectVoid` fixture uses an implicit-void return to verify the legacy shape still type-checks and fires.
- **Reducer mid-turn-end snapshot.** Handlers see the unit *with CT decremented* but turnState intact. Concrete: a handler that reads `args.unit.ct` sees `oldCT - ctCost`. Reads of `args.state.turnState.consumed.movesConsumed` are intact. This is the cleanest read-side semantics — the handler sees "the turn is ending; here's the consumed budget."

**Alternatives considered.**

- **Implement Quickstep as a hidden custom-trigger status** applied on Move-commit and consumed at turn-end. Avoids widening the hook. But the abstraction is heavy: a single passive instantiating a status to mediate its trigger reads as engine-side framework rather than content. The status-only path also doesn't generalize cleanly — future "end-of-turn after acting" / "end-of-turn after waiting" passives would each need their own hidden status. Hook widening is the one-time cost; status-instantiation is per-passive.
- **Add a new dedicated hook `onTurnEndEmit` alongside the void `onTurnEnd`.** Two hooks for one event boundary adds surface area. The runner would have to call both, and the source-ordering becomes ambiguous (do all `onTurnEndEmit` handlers fire before all `onTurnEnd`, or interleaved per source?). Widening the existing hook keeps the surface narrow.
- **Make the hook return a wider shape** like `{ state?: GameState; emittedActions?: ReadonlyArray<ProposedAction> }` so handlers could also modify state directly. Reduces purity: handlers writing state directly side-step the reducer's invariants. Emission-only matches the existing `onActionResolved` precedent.
- **Pass the `consumed` field instead of full state.** Handlers may want to read more than `consumed` (e.g., other unit's HP for an aoe-end-of-turn effect). Full state is the minimal-friction shape. Cost is the extra reference; benefit is no per-handler API expansion.

**References.**

- Session 26 brief: `docs/twentyOnePlanning/session-26-brief.md` (Architectural Decision 2)
- `src/engine/hooks/hooks.ts` (`onTurnEnd` signature, `OnTurnEndResult`)
- `src/engine/hooks/runners.ts` (`runOnTurnEnd`)
- `src/engine/actions/reducers.ts` (`reduceTurnEnd` — fire-site)
- `src/content/abilities/quickstep.ts` (first consumer)
- `src/engine/actions/on-turn-end-emit.test.ts` (emission + gating + void-handler compatibility)
- Related: ADR-0024 (status side-effect infrastructure, on*-hook emission slot precedent), ADR-0027 (status side-effect substrate)
