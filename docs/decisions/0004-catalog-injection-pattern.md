## ADR-0004: Catalog injection pattern

**Status:** Accepted
**Date:** 2026-05-03

## Context

The `Catalog` (session 2) holds static definitions — `StatusEffectType`, `AbilityDefinition`, `ClassDefinition`, `ItemDefinition`. Engine code that operates on a `Unit` will frequently need to look up the unit's class, equipped item stats, or applied status type to do its job. The CT system will need it once the hook chain lands; the reducer will need it; validation will need it; the AI will need it.

The question is *how* engine functions reach the catalog. Three plausible options:

1. **Module singleton.** A `getCatalog()` accessor returns a process-global instance set at startup. Engine functions call it ad hoc.
2. **Stored on `GameState`.** `GameState.catalog` is a property; functions that already take `state` get the catalog for free.
3. **Injected alongside `state`.** Engine functions take `(state, ..., catalog)` (or however ordered). Catalog is environment, not state.

Each has propagating consequences — the catalog is read everywhere — so picking once and committing is more important than micro-optimizing the call sites.

## Decision

**Catalog is injected alongside `state` to engine functions that need it.** It is not stored on `GameState`, and there is no module-global singleton.

The conventional signatures across the engine become:

```typescript
reduce(state, action, catalog, seed)
validateAction(state, action, catalog)
computeSpeed(state, unitId, catalog)        // when session 3 wires the hook chain
projectUpcoming(state, count, catalog)       // when projection consumes catalog data
getMovementProfile(state, unitId, catalog)
```

Functions that do not consume catalog data simply do not take the parameter. `computeSpeed` does not take it today (session 1) because there are no hook handlers to dispatch yet.

## Rationale

- **`GameState` is per-battle and immutable; catalog is shared and structurally irrelevant to state.** Storing the catalog on `GameState` would inflate every state snapshot with the same reference, blur the distinction between "the world" (catalog) and "the battle" (state), and create a tempting back door for code that wants to mutate definitions per-battle (which is a category mistake — that's what the Ruleset is for, per `architecture-overview.md`).
- **Singletons are how testing and replay get awkward.** A replay or AI search runs many simulations; tests run many scenarios concurrently. Module globals defeat both. The CLAUDE.md ground rule that the reducer is pure given `(state, action, seed)` is easier to honor when the catalog is an explicit input.
- **The verbosity is real but bounded.** Most engine functions take `state` already; adding `catalog` is one more parameter. It also documents at the type level which functions read static definitions and which do not — useful for reasoning about a function's blast radius.
- **Replay reproducibility.** Action logs are reproducible against an identified ruleset + catalog version (per `architecture-overview.md`'s "Rulesets and content"). Threading the catalog explicitly makes the reproducibility contract obvious; a singleton would let the catalog drift implicitly between commit and replay.

## Consequences

- **Engine subsystem signatures grow as catalog reads land.** Sessions 3 (status hooks consume StatusEffectType handlers), 4 (movement reads class movement profile), 5 (loadout validation reads bucket capacity), 7 (reducer dispatches per ability) will all add `catalog` parameters to their public functions. Each is a localized change.
- **A single test fixture for "the default catalog."** Session 2 puts `loadDefaultCatalog()` in `src/content/index.ts`. Tests construct it once and pass to whatever they exercise. The fixture builders in `src/engine/ct/test-fixtures.ts` (and any future shared fixtures) optionally accept a catalog so tests can either use the default or build a tailored one.
- **The catalog construction surface is a real public API.** `createCatalog(input)` and the definition shapes belong to the engine; content layers and tests use them. Documented as part of `engine/index.ts`'s public exports.
- **Determinism boundary stays clean.** The reducer's purity statement extends to `(state, action, catalog, seed) → (newState, outcome, generatedActions)`. Pinning the catalog version in the action log header (session 6/7) lets replays demand a matching catalog before re-execution.

## Alternatives considered

- **Module singleton with `setCatalog` / `getCatalog`.** Rejected primarily because of test-concurrency and replay implications; secondarily because it makes the data dependencies of any function invisible at the type level. Reconsidered every time a function's signature grows uncomfortably long; the answer remains no.
- **Catalog stored on `GameState`.** Tempting because it eliminates the parameter. Rejected because it conflates per-battle state with shared environment, and because immutable state snapshots would carry redundant references. Saving and replaying state would also need to carry the catalog around, reproducing the singleton problem in a different layer.
- **Currying / partial application** (`createEngine(catalog) → { reduce, validate, ... }`). Considered as a way to bind catalog once at app startup. Rejected for v1 because it adds an indirection layer (the engine becomes an object instead of a module) without changing what's at stake — calls would still depend on the bound catalog, just less visibly. Worth revisiting if the parameter list ever genuinely becomes painful, but the "explicit injection" form is the simpler default.
