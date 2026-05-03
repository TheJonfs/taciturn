# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`, if/when it exists).

---

## From session 2026-05-03 (core types + CT system)

### Suggested next-session scope

Roadmap session 2: **catalog infrastructure + minimal type definitions.** The shape will be the loader + lookup APIs (`catalog.getStatusType('haste')`, etc.) plus one stub instance per kind to verify end-to-end. Real content arrives in later expansion passes.

Watch the boundary with `src/content/`: per `architecture-overview.md`, the catalog *loader* lives in `src/engine/catalog/`, but the *data files* live in `src/content/{classes,abilities,statuses,items,maps}/`. The eslint layer rules already forbid `@content` from importing from other layers, but not the other direction — the engine reading from `@content` is allowed and is exactly how the catalog gets populated.

### Things noticed during the CT session

- **`BattleMap` rather than `Map`.** The design doc names the container type `Map`, but the codebase uses `BattleMap` so the type name does not shadow `globalThis.Map` everywhere it is imported. Worth a one-line note in `core-types.md` next time it is touched, but not urgent enough to chase now.
- **`compareForTrigger` in `ct/projection.ts` is internal.** If/when other CT-adjacent code (e.g., a future "is this Quick going to land before that spell?" query) needs the same tiebreaker, extract to `ct/tiebreakers.ts` and re-export. Don't extract speculatively.
- **`test-fixtures.ts` lives in `ct/`** because that is where it is currently consumed. When session 2/3 also need fixtures, lift to `src/engine/test-fixtures.ts` (a single shared one is healthier than a per-subsystem proliferation).
- **`computeActionSpeed` takes a `ChargedAction` directly,** not a `ChargedActionId`. Slight asymmetry with `computeSpeed(state, unitId)`. Reasoning: charged actions live in an array (no O(1) lookup), and projection iterates them anyway. Reconsider if a callsite ever needs the by-ID variant.

### Things considered but did not do

- **A `state` mutation primitive in projection.** `projectUpcoming` could `structuredClone(state)` and walk it. Rejected because we only need the entities' CT and Speed for projection, and a flat `SimEntry[]` snapshot is both faster and clearer about what is actually being projected forward.
- **An `advanceCT(state, ticks)` reducer hook.** Out of scope for session 1 — state mutation belongs in the reducer (session 7). The pure projection covers what session 1 needs.
- **An `OutOfBoundsError` class.** ADR-0002 names both `UnknownEntityError` and `OutOfBoundsError`, but only the former has a use site today (`getUnit`, `getChargedAction`). Spatial accessors land in session 4; defining the error class then keeps it honest.

### Open questions for later sessions (not blocking)

- **`StatusInstance` shape** — the placeholder is `{ readonly typeId: StatusTypeId }`. Session 3 (status system) will fill it in. CT will consume statuses via the hook chain at that point; `computeSpeed` is the natural first hook consumer.
- **Equipment / loadout / classState / learning fields on `Unit`** — intentionally omitted from the session 1 `Unit` type to keep it minimal. Sessions 5 and 6 add them. They should slot in without breaking the `Unit` shape because everything in session 1 is structural (no positional/variadic constructors).
- **`TurnState`, `GlobalEffect`, `BattleOutcome`** — placeholder empty-marker interfaces (`{ readonly _placeholder?: never }`). Empty type literal would be assignable from anything; the marker keeps them distinct without committing to a shape. Replace with real shapes in their respective sessions (9, 3+, 9).
- **The `as UnitId` / `as ChargedActionId` casts in `ct/projection.ts`** are inside `entryToEvent`, gated by the `entityKind` discriminant. Type-safe by construction but visible. Cleaner once session 7's reducer exposes a richer surface — we may revisit then.
