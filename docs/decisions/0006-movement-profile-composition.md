## ADR-0006: Movement profile composition

**Status:** Accepted
**Date:** 2026-05-03

## Context

`docs/design/map-and-battlefield.md` defines `MovementProfile` as a unit's spatial-capability descriptor: `moveRange`, `jump`, `terrainCosts`, `canEnter`, optional `specialMovement`. Composition rules per the design doc:

- Base values come from class.
- Equipment, level, and statuses contribute additive or multiplicative modifiers.
- Movement-bucket abilities (Move+1, Jump+2, Float, Fly) can modify any field.

Session 4 lands the movement subsystem (accessors, profile computation, pathfinding, range, LoS, AoE). The profile is the input to pathfinding, so its composition has to be decided up front. A wrong shape now means revisiting every modifier source later.

The profile mixes scalar fields (`moveRange`, `jump`) and structural fields (`terrainCosts`, `canEnter`, `specialMovement`). The hook system established in session 3 (ADR-0005) already has `modifyStatQuery(unit, statName, baseValue) → number` — the natural fit for the scalars but a poor fit for the structural fields.

The plausible options:

1. **One uber-hook (`modifyMovementProfile`).** Hand handlers the whole profile; they return a modified profile. Maximally flexible — any modifier shape fits.
2. **Per-field hooks.** `modifyStatQuery('moveRange')` and `('jump')` for the scalars; new event-style hooks (`modifyTerrainCosts`, `modifyCanEnter`, `modifySpecialMovement`) for the structural fields.
3. **Scalars via existing `modifyStatQuery`; structural fields direct from class baseline only, defer the modifier surface.** Implements just the scalar pipeline now; the structural-field hooks land with the first abilities that need them (Float, Fly, Phase) in session 5.

## Decision

**Option 3.** Move-range and jump compose via `modifyStatQuery` with `StatName` extended to `'moveRange' | 'jump'`. The structural fields (`terrainCosts`, `canEnter`, `specialMovement`) come straight from the class baseline today; their modifier surface is deferred to session 5 when the first consumer abilities arrive.

Concretely:

- `ClassDefinition` carries a required `movement: ClassMovementBaseline` field with all four fields and an optional `specialMovement`.
- `computeMovementProfile(state, unitId, catalog)` reads the class baseline, threads `moveRange` and `jump` through `runModifyStatQuery`, and passes the structural fields through unchanged.
- The returned `MovementProfile` is fully resolved — pathfinding doesn't need to know about absent or partial fields.
- Pathfinding only handles standard movement. If a profile carries `specialMovement` (no consumer in v1, but the data shape supports it), `getLegalMoves` throws `SpecialMovementNotImplementedError`. Implementations land with the first ability that demands them.

Why not option 1 (uber-hook): it conflates conceptually separate modifiers. A status that only changes Move+1 has to take the whole profile, mutate one field, return the rest unchanged — error-prone and noisy. It also gives every handler implicit access to fields it shouldn't care about.

Why not option 2 (per-field hooks now): premature. The structural-field hooks only have meaningful consumers in session 5 (Float, Fly), and we don't yet know whether `modifyTerrainCosts` returns a Map, applies as a delta, or merges in some other way. ADR-0005's reasoning on "implement runners with no consumers is an anti-pattern" applies here. Define the hooks when the consumer demands a specific shape.

## Consequences

- **The scalar pipeline works end-to-end today.** A Move+1 status (when content authors one) is `statusHook('modifyStatQuery', a => a.statName === 'moveRange' ? a.baseValue + 1 : a.baseValue)` — the same shape as Haste from session 3.
- **Float / Fly land cleanly in session 5.** Each will introduce one new hook (`modifyCanEnter` and `modifySpecialMovement`, or whatever shape proves right when the consumer is in front of us). Adding hooks to `HookSignatures` is a known one-edit operation per ADR-0005.
- **The class baseline is structural — every class declares its full canEnter / terrainCosts.** No magic-empty-set defaults; authors think about what their class can enter. Defaults move into the `RulesetDefinition` in session 6 if a sensible "default movement profile" needs to be configurable.
- **`StatName` grows by one entry per added stat.** Today: `'spd' | 'moveRange' | 'jump'`. Session 8 adds the damage stats. Each addition is a single edit; existing handlers stay valid because they discriminate on `args.statName`.
- **Special-movement implementation is deferred behind a clear error.** Anyone who passes a profile with `specialMovement` set into pathfinding gets an actionable error message rather than incorrect results. The boundary is honest.

## Alternatives considered

- **Storing the composed profile on Unit.** Rejected per CLAUDE.md ground rule 5: computed values are not cached in state. Movement profile is recomputed per query, same as Speed.
- **Treating `terrainCosts` and `canEnter` as `Partial<>` in the baseline with a global default merge.** Rejected — the magic-default behavior is hard to debug ("why can my Knight walk on water?") and pushes the question of "what's the default" into the wrong place. Defaults belong on a Ruleset (session 6); class-level structural fields are concrete.
- **Implementing fly / teleport / phase in pathfinding now as a stub.** Rejected — no consumer until session 5 introduces a flying or teleporting ability. Throwing on `specialMovement` keeps the contract honest and the implementation deferred to where the test cases will live.
