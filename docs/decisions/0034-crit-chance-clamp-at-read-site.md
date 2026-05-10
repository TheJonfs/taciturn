## ADR-0034: Crit_chance clamp at the read site

**Status:** Accepted
**Date:** 2026-05-10

## Context

The post-Session-20 engine audit (`docs/audits/post-20-engine-audit.md`, item E1) flagged that `crit_chance` is read through `runModifyStatQuery` in `critRoll` ([`src/engine/damage/handlers.ts`](../../src/engine/damage/handlers.ts)) and is not engine-clamped to `[0, 100]`. With Crit_modifier stacking via `STACK_INDEPENDENT`, six stacks of Static Embrace (default magnitude 20) on a v1-baseline unit (base 5) compose to 125. The roll `r >= crit_chance / 100` then evaluates against 1.25, making every roll a crit by overflow rather than by spec ("guaranteed crit at 100"). Any forecast / log surface that reads the same query — `src/ai/projection.ts` already independently clamps `p` for its own purposes, but other future readers would not — sees the nonsense percentage.

The post-reconciliation Mage War content spec (`docs/mage-war-content-spec.md`) calls for `crit_chance` to be "engine-clamped to [0, 100]." This ADR records the discipline that lands the clamp.

## Decision

Clamp the queried `crit_chance` to `[0, 100]` at the read site inside `critRoll`:

```typescript
const crit_chance = Math.max(
  0,
  Math.min(100, runModifyStatQuery(env.state, env.catalog, { ... })),
);
```

The clamp wraps the single read; both the `<= 0` short-circuit and the `r >= crit_chance / 100` roll comparison see the clamped value. Stacking past 100 becomes a no-op (5 stacks of Static Embrace cap a unit at 100% crit; the sixth stack is silently absorbed). Any reader of the same query inherits the same in-band value if a future forecast/log surface reads it through this site.

**Pattern: clamp probabilities at the read site, not at write time.** The hook chain stays additive and unaware of bounds; the consumer that interprets the value as a probability applies the clamp. Other stat queries that produce probabilities (evasion, status application chance, hit chance) follow the same shape — the read site, not the contributor, owns the bound.

### Rejected alternatives

- **Clamp inside the Crit_modifier hook handler.** The handler would need to know the running total, which it doesn't (the hook chain passes `baseValue` and the handler returns the next value). Clamping per-handler doesn't compose: two handlers each capping at 100 still let composition run away below the cap.

- **Clamp at write time on `baseStats.crit_chance`.** No content writes outside `[0, 100]` directly; the runaway is at composition time. A baseStats-level clamp wouldn't have caught the bug.

- **Clamp inside `runModifyStatQuery`.** Would require the runner to know which stats have probability semantics. The runner is stat-name-agnostic by design (per ADR-0005). The right place is the consumer.

## Consequences

- **Stacking Crit_modifier past 5 stacks is silent.** A unit with 6× Static Embrace shows as "100% crit" wherever the value is read. Players don't see "125% crit" in the log or forecast surface (when one ships). This matches the spec intent — the cap is the design ceiling, not a display artifact.

- **Forecast/projection surface (when added to the UI) reads the clamped value through this site.** No separate clamp needed in the forecast layer; the engine path is the single source of truth. `src/ai/projection.ts` retains its own clamp at line 142 because it computes `p` for its own probability math; that clamp is a defensive duplicate that should be removed when the UI's forecast layer is unified with the AI's projection (open work beyond Session 21).

- **Negative compositions are also pinned to 0.** No content currently produces a negative-magnitude Crit_modifier, but the symmetry is documented and tested. The existing `<= 0` short-circuit covers the runtime behavior; the lower clamp ensures any reader of the queried value sees `0` instead of a negative number.

- **Test coverage.** `src/engine/actions/session-20-integration.test.ts` adds two tests in the `crit_chance clamp` section: 6× Crit_modifier on base-5 → effective 100 across multiple seeds (every roll crits, deterministically); base -50 with no modifier → no crit (lower clamp via short-circuit). The existing `Crit_modifier` describe block continues to cover the additive composition path; the new tests cover the clamp.

## Related

- ADR-0005 — hook system typing (chain runners are stat-name-agnostic)
- ADR-0032 — Lightning Mage substrate (introduced Crit_modifier and the `crit_chance` hook surface)
- `docs/audits/post-20-engine-audit.md` — Section E.1 (originating finding)
- `docs/mage-war-content-spec.md` — calibration spec (cap target)
