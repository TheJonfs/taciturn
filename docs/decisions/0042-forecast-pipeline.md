## ADR-0042: Forecast pipeline — engine-side module composing existing pure queries

**Status:** Accepted
**Date:** 2026-05-10

## Context

Session 24's brief calls for a forecast hover surface during target-select / await-confirm that shows damage range (min/expected/max), hit chance, status application probabilities, and AoE per-target preview. The post-Session-20 engine audit (Item 19) confirmed the projection substrate is sufficient — what's needed is **API surface**: forecast-friendly entry points over existing pure functions.

Two structural questions:

1. **Where do the forecast helpers live?** Options: in a new `src/engine/forecast/` module that composes existing primitives; inline-extended into each subsystem's existing module (`src/engine/ct/projection.ts`, `src/engine/status/chance.ts`, etc.); or UI-side in `src/ui/`.
2. **How is the projection's `crit_chance` clamp kept in sync with the runtime's?** The runtime clamps inside `critRoll` per ADR-0034. The AI's `projectionCritRoll` is a separate handler that doesn't route through that clamp; pre-Session-24 it carried its own duplicate clamp (`src/ai/projection.ts:142`). Naively dropping the duplicate to follow ADR-0034's spirit would re-introduce E1's bug in projection-land.

## Decision

**Forecast lives in a new `src/engine/forecast/` module.** Four sub-files plus a barrel:

- **`forecast/damage-range.ts`** — `projectDamageRange(...)` returns `{ min, expected, max }`. Composes the existing `projectExpectedDamage` shape from `src/ai/projection.ts` by varying the variance bounds (min runs at `variance.min`, max at `variance.max`, expected at midpoint). Every other random handler — evasion, crit — is handled by the projection registry's expected-value substitutes, so all three bounds share the same hit-chance × crit-expectation treatment.
- **`forecast/status-chance.ts`** — `projectStatusChances(...)` enumerates declared status effects on an ability and returns the projected application chance per effect. Consumes a new `computeStatusChance(args)` extracted from `rollStatusChance` (same body, no random draw).
- **`forecast/ct-preview.ts`** — `projectTurnEndCt(...)` computes end-of-turn CT given a candidate next action and the active unit's current consumed budget. `projectChargedResolution(...)` finds a charged action in the upcoming-events projection and returns its position plus a 5-7 event surrounding window, for the forecast panel's Timing subsection.
- **`forecast/aoe-preview.ts`** — `projectAoePreview(...)` returns the AoE footprint as `AoePreviewTile[]` (position, occupant, affected). Mirrors the live `resolveAbilityTargets`' filter rules — exclude caster (when `excludeCaster` is set), exclude friendlies (when ruleset.behaviors.friendlyFire is false), skip KO'd units.

The module is pure (no state mutation, no random draws, no side effects), engine-side (no React, no PixiJS), and composable. The AI can adopt the same queries once Phase B's AI tier-3 work lands; today's consumers are the UI surfaces in `src/ui/forecast-*.tsx`.

**`crit_chance` clamp consolidation.** Extracted a shared `readCritChance(env, attacker)` helper in `src/engine/damage/handlers.ts` that performs the `[0, 100]` clamp once. Both the live `critRoll` and `src/ai/projection.ts`'s `projectionCritRoll` import it. The duplicate clamp at `src/ai/projection.ts:142` is gone; both code paths now share one read site. New test in `src/ai/projection.test.ts` ("clamps queried crit_chance at 100") verifies projection-mode behavior at `crit_chance > 100`.

### Rejected alternatives

- **Inline-extend each subsystem's existing module.** Mixes "preview" with "runtime" semantics inside the same files; `ct/projection.ts` would gain UI-flavored "what would my end-CT be?" helpers; `status/chance.ts` would gain a non-rolling variant alongside the rolling one. Splitting forecast out keeps each subsystem focused.

- **UI-side forecast helpers.** Would couple "what would happen?" math to the UI module. Two costs: (a) AI eventually wants the same composed queries — keeping them engine-side leaves the door open; (b) the engine boundary already enforces "pure, no React, no PixiJS" — forecast composition belongs on the inside of that boundary.

- **Drop projection's clamp without the shared helper.** The naive "ADR-0034 covers it" reading is wrong — the projection uses its own `projectionCritRoll` handler that doesn't go through `critRoll`'s clamp. The shared helper makes the two paths actually share one read site, which is the spirit of ADR-0034 ("clamp at the read site, not at write time").

## Consequences

- **The forecast module is the unified surface for hover-aware preview math.** New forecast views (reaction trigger preview, knockback preview, fall damage preview, etc.) add as additional files in `src/engine/forecast/`, composed from the same primitives.

- **Projection contract stays single-sourced.** Future random handlers in the damage pipeline need a corresponding projection variant (per ADR-0033's drift-guard discipline); the shared `readCritChance` pattern is the recommended shape for any future "clamp at read site" stat that the projection also reads.

- **UI consumers see a stable engine API.** `src/ui/forecast-compose.ts` is the UI-side composer that pulls together damage range + status chance + AoE preview + CT preview into a `Forecast` payload the panel and tooltip both consume. Engine signature changes ripple cleanly through the composer.

- **AI adoption is straightforward.** When AI tier 3 wants to reason about, e.g., "what's the chance my status applies?", it imports from `src/engine/forecast/` directly. The current AI tier 2 still uses `projectExpectedDamage` from `src/ai/projection.ts`; nothing in this session changes that.

## Related

- ADR-0033 — AI tier 2 projection + drift guard (the projection-handler swap pattern this builds on)
- ADR-0034 — `crit_chance` clamp at read site (the discipline the shared `readCritChance` extends)
- `docs/audits/post-20-engine-audit.md` §Item 19 — forecast contract assessment
- `docs/twentyOneDesign/battle-ui-architecture.md` §"The Forecast Pipeline"
