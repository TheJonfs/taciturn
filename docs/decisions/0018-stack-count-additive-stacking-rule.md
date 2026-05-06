## ADR-0018: STACK_COUNT_ADDITIVE stacking rule

**Status:** Accepted (enum value lands now; reducer logic lands session 19)
**Date:** 2026-05-06

## Context

The `StackingRule` enum today has six values: REFRESH, REPLACE, REPLACE_IF_STRONGER, STACK_INDEPENDENT, STACK_ADDITIVE, REJECT. Per `src/engine/types/stacking-rule.ts`, `STACK_ADDITIVE` is documented as "magnitudes add; duration refreshes."

Burn (session 19) wants different semantics:
- Each application of Burn adds **1 stack** (or more) to a single instance.
- The stack *count* — not the magnitude — drives behavior. On CT-100 trigger, Burn deals `current_stack_count × burn_damage_per_stack` damage, then decrements the stack count.

`STACK_ADDITIVE` doesn't fit. Its rule "magnitudes add" is the wrong shape — Burn doesn't have a meaningful "magnitude" to sum; what it needs to sum is *occurrences*. Two options surfaced (reconciliation report item 3.8):

1. Reuse `STACK_ADDITIVE` with a per-status flag declaring whether stacks or magnitudes accumulate.
2. Introduce a separate `STACK_COUNT_ADDITIVE` rule.

## Decision

**Add `STACK_COUNT_ADDITIVE` as a distinct value in the `StackingRule` enum.** Each rule keeps unambiguous semantics:

- `STACK_ADDITIVE`: magnitudes add; duration refreshes; **stack count stays at 1**. Used for additive stat modifiers (e.g., Strength Up: +1 from one source plus +2 from another yields a single instance with magnitude 3).
- `STACK_COUNT_ADDITIVE`: stack count increments; duration refreshes; **magnitude is per-stack semantically (see below)**. Used for stack-count-driven statuses where the count itself is the load-bearing dimension (Burn).

When applying a `STACK_COUNT_ADDITIVE` status to a unit that already carries an instance, the existing instance's `stacks` field increments by the application's quantity (default 1). Magnitude on these statuses is a per-stack constant — Burn's `5 damage per stack` is its `defaultMagnitude`; the trigger handler reads `instance.stacks × magnitude` to compute damage on trigger.

## Rationale

**Why not reuse `STACK_ADDITIVE` with a flag.** A flag-driven rule has different behaviors depending on a boolean at the status type level. Two semantics under one name is exactly the "tag-dependent semantics" pattern that creates bugs — handlers and tests have to remember to check the flag, and it's easy to write logic that's right for one mode and wrong for the other. Separate rules with clear names eliminate that ambiguity.

**Why this fits the existing rule shape.** Each `StackingRule` value names a single rule about what happens on application. `STACK_INDEPENDENT` (multiple instances coexist), `STACK_ADDITIVE` (one instance, magnitudes sum), `STACK_COUNT_ADDITIVE` (one instance, stack count increments) form a coherent family of "additive composition" patterns differentiated by the dimension that's added.

**Why `stacks` on `StatusInstance` already supports this.** The existing `stacks?: number` field on `StatusInstance` (used today for `STACK_INDEPENDENT`) becomes the load-bearing dimension for `STACK_COUNT_ADDITIVE` too. Per-instance stack count is already a thing the engine knows about.

## Implementation

**Land the enum value in 13.7.** The type extension is one line in `src/engine/types/stacking-rule.ts` and a new branch in `apply.ts` that throws "STACK_COUNT_ADDITIVE not yet implemented" until session 19's Burn ships. Adding the enum value now:
- Keeps the spec and the engine type aligned.
- Documents the architectural commitment in code, not just in this ADR.
- Means session 19's work is "implement the branch," not "design the rule plus implement the branch."

**Land the reducer logic in session 19, alongside Burn.** When Burn ships, the apply.ts branch implements: "if existing instance, increment its stack count; else instantiate with `stacks: 1` (or the application's stack quantity)." The duration refresh follows STACK_ADDITIVE's pattern.

## Consequences

- **`StackingRule` gains one value.** `apply.ts`'s switch on stacking rule grows one branch (which throws until session 19).

- **Burn's status type declaration is unambiguous.** `stackingRule: 'STACK_COUNT_ADDITIVE'` — no flag interpretation needed; the rule directly states the behavior.

- **Future stack-count-driven statuses inherit the same rule.** If a future "Bleeding" or "Soaked" status wants stack-count semantics, it picks `STACK_COUNT_ADDITIVE` without designing a new rule.

- **The reducer's switch over `StackingRule` is exhaustive.** TypeScript will surface any `StackingRule` value that the switch doesn't handle. When `STACK_COUNT_ADDITIVE` lands as an enum value, the switch must handle it (with a throw, until session 19).

- **The ability format spec mirrors this.** `StackingRule` in the spec gains the same value with the same meaning; Burn's example references it.

- **No magnitude semantics drift in `STACK_ADDITIVE`.** The other path stays "magnitudes add"; nothing about it changes.

## Alternatives considered

**Reuse `STACK_ADDITIVE` with a flag.** Rejected per the "tag-dependent semantics" argument. Two behaviors under one name is the kind of cleverness that produces bugs.

**Burn re-purposes its `magnitude` as a stack count.** Rejected — magnitude is a per-stack constant for Burn (5 damage per stack), and treating it as a stack count loses that distinction. The trigger formula `stacks × magnitude` is cleaner with both fields populated.

**Decompose stacking into two orthogonal axes (stacks vs. magnitude).** Rejected as over-engineering for v1. Each existing rule maps to a single behavior; introducing two-axis composition would be a larger redesign without payoff. If a future status needs both stacks and magnitudes (e.g., a stacking buff where each stack adds a different bonus), revisit then.

## References

- `src/engine/types/stacking-rule.ts` — current enum.
- `src/engine/status/apply.ts` — switch over rule values.
- `docs/battle-mechanics-guide.md` — Burn-specific stacking section.
- Reconciliation report item 3.8.
