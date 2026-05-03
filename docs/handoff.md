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

## From session 2026-05-03 (map and movement)

### Suggested next-session scope

Roadmap session 5: **ability slots** — bucket capacity, per-character cost computation, loadout validation, equip operation. Pure functions; no integration with the reducer.

Two mechanism gaps that *intersect* the ability-slots session and should be considered for landing alongside (not deferred further):

1. **Movement-bucket modifier hook surface.** Float adds `'water'` to `canEnter`; Fly sets `specialMovement = 'fly'`; Phase sets `specialMovement = 'phase'`. Per ADR-0006 these were deferred to session 5. Decide on hook shape (likely separate hooks: `modifyCanEnter`, `modifyTerrainCosts`, `modifySpecialMovement`) when the first concrete passive ability is being authored. Add the hook signatures to `HookSignatures` and runners to `engine/status/runners.ts` (or a new movement-side runner module). Any new hook is a one-edit addition per ADR-0005.
2. **Special-movement pathfinding implementations.** `getLegalMoves` throws `SpecialMovementNotImplementedError` if a profile has `specialMovement` set. When session 5's first passive sets one of these, implement the corresponding pathfinding branch:
   - **Fly:** standard adjacency but ignore the elevation-differential check (jump constraint doesn't apply).
   - **Teleport:** all in-bounds tiles within `moveRange` Manhattan distance whose terrain is in `canEnter` and is unoccupied; path is `[source, destination]`.
   - **Phase:** standard adjacency, but unit-occupancy check is skipped (still can't end on an occupied tile).

   These are small, but add them only when a content ability needs them — same anti-pattern guard as the `onMoveStep` runner.

### Things noticed during the map/movement session

- **`Unit.classState` is a one-field shim** (`{ currentClass: ClassId }`) introduced this session because pathfinding needs the class. Session 6's full progression session will expand it to `{ currentClass; classProgress: Map<ClassId, ClassProgressionState> }`. The grouping is already in place, so session 6's change is purely additive — no field renames, no callsite migration.
- **`Unit.classState.currentClass` defaults to `'knight'` in `makeUnit`.** All existing CT/status tests pass an `emptyCatalog` — they don't reach `computeMovementProfile`, so the default is harmless. Tests that *do* reach map code build their own catalog (as the new map test files demonstrate).
- **`ASCII mapFrom` legend defaults are `G`/`W`/`S`/`.` only.** Real maps will need richer terrains; the legend is intentionally minimal — extend per-test via the `overrides` parameter or grow the defaults when content patterns emerge.
- **`tilesAt` / `tileAt` / `unitAt` are O(N) over `map.tiles` / `state.units`.** At v1 scale (≤400 tiles, ≤20 units) this is trivial even when called per-step from pathfinding. Don't index until profiling shows a hotspot. Especially for `unitAt`: the unit map is keyed by ID, not position; building a position index would mean keeping it in sync as units move, which is the kind of bookkeeping ADR-0005 explicitly avoids ("recompute on read" wins for v1).
- **`getLegalMoves` priority queue is a linear-scan dequeue.** Same calculation: trivial at v1 scale. Heap-based PQ is a known later optimization if profiling demands it.
- **LoS algorithm is intentionally a v1 simplification** — Bresenham over the (x, y) line, strict inequality on grazing. The design doc flags rasterization tie-breaking as TBD; revisit when game-feel testing reveals false-pass / false-block cases. Likely upgrade path: "supercover" rasterization, or a thicker-line variant. `engine/map/line-of-sight.ts` has a comment noting the current rule.
- **LoS does not consider unit blockers.** Per the design doc this is an ability flag (`pierces_units` / `blocked_by_units`) that lands when actions are typed; not the LoS function's concern.
- **AoE line and cone shapes are deliberately not implemented.** Both depend on directional-anchor semantics that ride with the action layer (session 7). The shape-set is open for additions — adding `'line'` or `'cone'` is one new arm in `shapeOffsets`'s switch.
- **AoE multi-layer "all qualifying tiles affected" is the implemented default.** The design doc flags this as overrideable per-ability; flag-driven variants land with the action authoring layer.

### Things considered but did not do

- **Implementing fly / teleport / phase pathfinding now.** Considered as "while we're here." Rejected — same anti-pattern as implementing runners with no consumers. The branches are small enough to add when the first passive demands them in session 5; the data shape (`specialMovement` field on `MovementProfile`) is in place.
- **Implementing `onMoveStep` runner.** Confirmed deferred per the previous session's handoff note. No consumer until a movement-modifying status (Don't Move, Float as a movement-step thing if it gets that, etc.) needs it.
- **Defaulting `canEnter` to "all standard ground terrains."** Considered for ergonomics. Rejected because `TerrainType` is an open string union — there's no canonical "all standard" set. Forced authors to declare canEnter explicitly. Defaults belong in a Ruleset (session 6) if they're useful.
- **Storing tile-position → tile index on the BattleMap.** Trivial speed-up for `tilesAt` / `tileAt`. Rejected per "no caching computed values" and the v1-scale argument; revisit only on profiling evidence.
- **Promoting `Vector2`/`Vector3`-style position math into a separate utility.** Considered as the spatial code grew. Rejected — current sites are short and direct, and the design doc's separation of (x, y) horizontal vs. layer/elevation makes a single `Vector` abstraction awkward (layer is structural; elevation is mechanical).
- **A composite `TargetingValidation(action, source, target)` function.** It would call `inRange` + (LoS or arc) per ability targeting mode. Rejected as session-7 work; that's where ability targeting lives. Today's `inRange` / `hasLineOfSight` / `arcTargetable` are the building blocks.

### Open questions for later sessions (not blocking)

- **Friendly pass-through.** Pathfinding currently treats every other unit (regardless of team) as impassable. The design doc lists this as a Ruleset flag; v1 default likely "allies pass through, enemies block" per FFT. Lands with session 6's RulesetDefinition.
- **`onMoveStep` hook payload shape.** Currently `{ unit, fromTile: unknown, toTile: unknown }` in `HookSignatures` — `unknown` because no consumer has demanded a real shape. When the first per-step status arrives, replace the `unknown`s with real types.
- **"Highest-layer-only" / "lowest-layer-only" AoE flag.** Per the design doc's open question; lands when an ability needs to opt out of the "all qualifying layers affected" default.
- **Whether `getLegalMoves` should also report illegal but in-range tiles** (e.g., tiles a unit could *almost* reach but for one rule). UI may want to grey them out distinctly. Defer until UI/AI need it; probably a separate `getMovementCandidates` rather than complicating `getLegalMoves`.
- **`Position` vs `RangeEndpoint` vs `ArcEndpoint` vs `AoeAnchor` proliferation.** Today they're distinct shapes with deliberately small surface areas (each carries only the fields its consumer needs). If they start growing in lockstep, consider a unified spatial-target type — but only if the asymmetry becomes painful.
