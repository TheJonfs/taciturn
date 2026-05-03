## ADR-0003: ChargedAction shape and projection-after-trigger assumption

**Status:** Accepted
**Date:** 2026-05-03

## Context

`docs/design/ct-system.md` defines Charged Actions as first-class CT entities — they accumulate CT each tick at their own Action Speed, trigger on reaching 100, and appear in the projection queue alongside Units. `docs/design/core-types.md` declares `chargedActions: ChargedAction[]` on `GameState` but explicitly leaves the field shapes illustrative.

Session 1 implements the CT projection (`nextEvent`, `projectUpcoming`). Both functions iterate units *and* charged actions, so the ChargedAction type has to be concrete now. Two related decisions that the design docs do not pin down:

1. **What goes inside `ChargedAction`?** Caster, target(s), and "any state needed to resolve" — but specific field names and what "any state" means.
2. **What does projection assume happens *after* a unit triggers?** A real turn might cost 100 CT (Move + Act) or 20 CT (Wait), depending on player choice. The projection has to assume something to extend past one event.

## Decision

### ChargedAction shape

```typescript
interface ChargedAction {
  readonly id: ChargedActionId;
  readonly casterId: UnitId;
  ct: number;                           // accumulates each tick toward 100
  speed: number;                        // current Action Speed (modifiable)
  readonly abilityId: AbilityId;
  readonly targets: ReadonlyArray<TargetRef>;
  readonly sourceSequenceNumber: number;  // the Action that initiated the charge
}

type TargetRef =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'tile'; readonly position: Position };
```

Notes on what is and is not in this shape:

- **`ct` and `speed` mirror the Unit shape exactly.** Same accumulation rule, same threshold, so the projection code treats both kinds of entity through one path. Speed is stored, not computed, because Action Speed is set at cast time and modified by CT-affecting abilities (Hasten Charge, Slow Action) — there is no per-cast hook chain analogous to a unit's stat computation.
- **`abilityId` is the catalog reference.** Anything ability-shaped (damage formula, cost, hooks) is read from the catalog at resolution time. Caching it on the instance would create the same staleness risk that the "computed vs. stored" rule warns against.
- **`targets` is captured at cast time.** The design doc's "target(s) at time of cast" — frozen here so the resolver doesn't re-query intent. `TargetRef` is a small discriminated union; Unit and Tile cover the v1 ability surface. Future target kinds (charged-action-as-target for counterspells, area-anchor) extend the union.
- **`sourceSequenceNumber` is the back-reference to the originating Action.** Lets replay reconstruct the cast without searching the log; lets dispel/counterspell cite the original action in their outcome records.
- **No `Charging` status reference here.** The pairing is enforced by the reducer: when a `ChargedAction` is created, the `Charging` status is applied to the caster; when it resolves or is cancelled, the status is removed. Both directions are looked up by `casterId` when needed. Storing a back-reference would be a stored-redundant-pointer and the kind of consistency bug the architecture rules call out.

### Projection-after-trigger assumption

The projection queue (`projectUpcoming(state, count)`) needs an assumption about what a triggering Unit does, since a real turn's CT cost is a player choice not yet made. The assumption baked into v1 projection:

- **A triggering Unit's CT resets to 0.** This corresponds to a full Move + Act turn (cost 100 per `ct-system.md`'s parameter table), the most expensive common option.
- **A triggering ChargedAction is removed from the queue.**

Rationale: the projection's job is "who acts in what order, given no new actions taken" (ct-system.md). The most informative single assumption is "everyone takes a full turn" — it is the conservative case for tempo planning. Wait-based projections would systematically *under-state* how much breathing room a unit has before its next turn, which is the opposite of useful. Move-only / Act-only projections require knowing player intent.

The assumption is **not parameterized** in session 1. When the Ruleset lands (session 6), the per-turn CT costs become Ruleset parameters, and `projectUpcoming` will read them through the active ruleset. Until then, the constant `100` is named in `ct/projection.ts` with a reference to this ADR.

## Consequences

- **CT projection is one code path for both entity kinds.** The local snapshot inside `projectUpcoming` is `{ id, kind, ct, speed }` regardless of source.
- **The `Charging` status pairing is a reducer invariant, not a type-system invariant.** Tests for the eventual cast/resolve/cancel reducer paths must verify the pairing in both directions. Until the reducer exists (session 7), session 1 cannot test it.
- **The projection assumption diverges from real outcomes.** A player who Waits gets a turn back faster than the projection shows. UI built on top of `projectUpcoming` should label the queue as a forecast, not a commitment. Worth surfacing again when the projection-queue UI lands (session 11).
- **Extending `TargetRef` is forward-compatible.** New target kinds add a discriminated arm; existing arms keep typing.

## Alternatives considered

- **`ctRemaining` / `ctCostTotal` shape** (counting down from a cost). Rejected because it inverts the CT model — Units count *up* to 100, and treating ChargedActions as the same kind of entity is the whole point. The duplicated mechanism would make the projection code branch unnecessarily.
- **Storing the resolved ability definition snapshot on the ChargedAction.** Considered for "stability across mid-cast catalog reloads," but rejected: the catalog is loaded once at battle start, and snapshotting would create the stale-pointer problem the identity-by-ID rule prevents.
- **Storing a `chargingStatusId` back-reference** so cancel/resolve can remove the paired status without a lookup. Rejected: the lookup is `O(1)` by `casterId` and adding a back-reference is exactly the kind of stored-derivable-pointer that creates consistency bugs.
- **Parameterizing the projection assumption now** (per-unit "next action will be Wait"). Rejected because the data needed (per-turn CT costs) lives in the Ruleset, which is session 6. A constant with a named reference is cleaner than half-baked parameterization.
