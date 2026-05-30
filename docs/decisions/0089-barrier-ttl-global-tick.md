## ADR-0089: Barrier TTL ticks globally (every turn_start), not on the owner's turn

**Status:** Accepted
**Date:** 2026-05-30
**Session:** 54

## Context

S53 (ADR-0088) modeled the Worldcraft Barrier's lifetime as a TTL on the owner's effect-queue entry, decremented by `decrementBarrierTtls(unit)` called from `reduceTurnStart` **for the turn-taking unit only**. That cadence has a latent bug the substrate session flagged as deferred: a barrier's TTL only counts down on its *owner's* turns, so an owner who is KO'd, Stopped, or removed from battle — and therefore takes no turns — freezes its barriers' countdown indefinitely. The blueprint is explicit that barrier effects persist past owner KO and "keep ticking," precisely so a dead Terraformer's walls still expire on schedule rather than becoming permanent terrain.

The S54 brief settled the call (D2, confirmed in plan-review): the TTL ticks **regardless of owner state**.

## Decision

`reduceTurnStart` now decrements **every** unit's barrier TTLs by one on **every** `turn_start`, independent of which unit is taking the turn:

```ts
let stateAfterTtl = state;
const barrierClears: ProposedAction[] = [];
for (const u of state.units.values()) {
  const tick = decrementBarrierTtls(u);
  if (tick.unit !== u) stateAfterTtl = withUnit(stateAfterTtl, tick.unit);
  for (const a of tick.clearActions) barrierClears.push(a);
}
const tickedUnit = getUnit(stateAfterTtl, unitId);
```

`decrementBarrierTtls` is unchanged (it already prunes expired entries and emits a `system_barrier_change` clearing their tiles, and returns the same unit reference untouched when the unit holds no barrier effects — a genuine no-op for every non-Terraformer). The change is purely the **fan-out**: from one unit to all units. Map iteration is insertion-ordered, so the accumulation is deterministic.

This makes a barrier's lifetime independent of its owner: it counts down on each `turn_start` whether the owner is alive, KO'd, Stopped, or removed from the battle entirely. The tile-side `BarrierState.ttl` remains a spawn-time snapshot; the queue entry stays authoritative for expiry (ADR-0088).

LIFO cap eviction (`enqueueWorldcraftEffect`) is untouched and orthogonal — a barrier can still be evicted by a later cast before its TTL expires.

## Consequences

- **Cadence is per-turn, not per-round.** A barrier with `ttl: 5` expires after 5 `turn_start` events. In a multi-unit battle that is several units' turns — roughly half a round in a 5v5 — which is faster than S53's de-facto once-per-owner-turn rate. **The TTL number (5) is the tuning knob**; whether 5 turns feels right, or barriers should last longer to serve their "chokepoint denial / time-buying" role, is a playtest question (see `playtest-watch.md`). The alternative — a true per-round cadence — has no clean engine event today (turn order is CT-driven with no explicit round boundary), so the per-turn-start tick is the simplest owner-independent cadence.
- **Owner-independence achieved.** A KO'd / Stopped / removed owner's barriers now count down and expire normally (regression-tested).
- **Determinism preserved.** The reducer stays pure given `(state, action, seed)`; the global loop is deterministic over the insertion-ordered unit map.

## Alternatives considered

- **Per-team-turn-start decrement** (the brief's noted alternative) — still owner-independent, but no simpler than the global tick and introduces a team-cadence concept with no other consumer. Rejected for the plain global tick.
- **A dedicated round-boundary event to tick once per round** — would preserve S53's ~per-round rate, but the engine has no round concept (CT-driven turn order); inventing one for this single consumer is unjustified. Deferred unless playtest shows the per-turn rate is unworkable even after tuning `ttl`.
- **Leaving the owner-gated decrement and clearing barriers on owner KO instead** — contradicts the blueprint's "barriers persist past owner KO" intent.
