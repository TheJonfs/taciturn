## ADR-0002: Accessor return-type pattern

**Status:** Accepted
**Date:** 2026-05-03

## Context

`tsconfig.app.json` enables `noUncheckedIndexedAccess`. Every indexed read of an array, `Record`, or `Map` returns `T | undefined`. The engine has many natural-feeling accessors — `tileAt`, `tilesAt`, `unitAt`, `getUnit`, `getChargedAction` — that will be called from every subsystem. Without a single house pattern, each module would invent its own narrowing convention, the call sites would mix `if (x)`, `assert(x)`, and `x!` arbitrarily, and the question would have to be re-litigated every time a new accessor is added.

The plausible options were:

1. **Always return `T | undefined`.** Caller narrows. Maximally honest about runtime conditions; maximally noisy at every call site.
2. **Always throw on missing.** Caller narrows the inputs first. Quietest at call sites; turns a wrong call into a runtime panic.
3. **Always return a `Result<T>` shape.** Forces handling but introduces a layer of structural plumbing everywhere; idiomatic in some languages but heavy in TypeScript.

The handoff from session 0 flagged this as something to settle before the CT session. Engine-wide consistency matters more than the ergonomics of any single call site.

## Decision

A single rule, applied uniformly:

- **Throw when the input represents a programmer error.** Out-of-bounds tile coordinates, unknown `UnitId`, unknown `ChargedActionId` — these are bugs in the caller, not runtime conditions. The accessor throws (`Error` subclass; messages identify the bad input). Callers narrow upstream by validating ranges or only passing IDs that came from iterating the collection.
- **Return `T | undefined` when absence is a meaningful runtime answer.** "No unit on this tile" or "no tile at this layer at (x, y)" are normal answers, not errors. The caller is expected to handle both branches.

Concretely, for the accessors named in `core-types.md`:

| Accessor | Returns | Throws on |
|---|---|---|
| `tilesAt(map, x, y)` | `Tile[]` (possibly empty) | (x, y) outside map bounds |
| `tileAt(map, x, y, layer)` | `Tile \| undefined` | (x, y) outside map bounds |
| `unitAt(state, x, y, layer)` | `Unit \| undefined` | (x, y) outside map bounds |
| `getUnit(state, id)` | `Unit` | `id` not in `state.units` |
| `getChargedAction(state, id)` | `ChargedAction` | `id` not in `state.chargedActions` |

The split is consistent: bounds errors throw, semantic absence returns `undefined`. The principle the table follows is "if asking the question requires the caller to already know the answer is in-range, it should throw when out-of-range; if the question is genuinely 'is there one or not?', it should return `undefined`."

`Result<T>` is rejected. With strict typing already enforcing the `T | undefined` branch checks, `Result` would add ceremony without adding safety.

## Consequences

- **Call sites are quieter.** Most engine code passes `UnitId`s that came from iterating `state.units`; those calls don't need narrowing.
- **The throw points are real.** A `getUnit` call that throws indicates a bug — typically a stale ID held past the unit's removal, or a typo. Stack traces will pinpoint it. This matches the CLAUDE.md anti-pattern against silent fallbacks.
- **A small custom error type per accessor family.** `OutOfBoundsError` for spatial accessors; `UnknownEntityError` for ID-based accessors. The reducer (session 7) will catch these only at the top of action processing as a last-ditch defense; engine-internal code does not catch them.
- **Future accessors follow the table.** When session 4 adds movement-related accessors and session 5 adds loadout accessors, they slot into the same split. No per-module re-litigation.

## Alternatives considered

- **Returning `T | undefined` everywhere.** Rejected as a default because the noise drowns out the cases where absence is actually meaningful, making it harder for readers to spot real branching logic.
- **Throwing everywhere.** Rejected because `unitAt(x, y)` and `tileAt(x, y, layer)` have a legitimate empty answer; forcing callers to wrap legal queries in try/catch is worse than returning `undefined`.
- **A `Result<T>` wrapper type.** Rejected as out of proportion to the safety it adds in a strict-typed codebase. Reconsider only if the codebase grows to a scale where stack-trace-based debugging stops scaling — not foreseeable for v1.
