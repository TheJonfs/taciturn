## ADR-0094: Threat coverage map (the incoming-threat model, Layer 1)

**Status:** Accepted
**Date:** 2026-06-10

## Context

The S59 brief (`docs/thirtyNinePlanning/session-59-threat-model-brief.md`)
builds the **incoming-threat / danger model** — the keystone the audit
(S57 handoff, A4) found absent. Three consumers ride it: the defensive
above-melee-reach term, Barrier denial, and (decoupled) Tier C revert-traps.
Per the blueprint (§3) the model has two layers; only **Layer 1** is built
here:

- **Layer 1 — coverage map.** "Which enemies can reach-and-hit tile X this
  turn, tagged melee vs. ranged, with expected damage." A pure function of
  board state, queryable on hypothetical (elevation- and barrier-mutated)
  states.
- **Layer 2 — positional prediction** (where an enemy will actually *be*
  next turn) — **deliberately deferred** (Chris's call). Consumers evaluate
  against positions as they stand this turn.

The building blocks existed (`getLegalMoves`, `computeAbilityRange` with the
S52 bow height-range bonus, `projectExpectedDamage`, `hasLineOfSight`,
`arcTargetable`); no aggregation tied them into a tile→threats structure.

## Decision

A new pure module `src/ai/threat/coverage-map.ts` exposes
`buildCoverageMap(state, catalog, occupant)` (full per-turn map) and
`threatsToTile(state, catalog, occupant, tile)` (single-tile, for Barrier
denial's per-candidate query). Both share one inner reach-and-project path,
so they cannot drift (a test pins their agreement).

### 1. Reach mirrors the engine's targetability gate — including LoS/arc

A threat is recorded only when the attacker, from a tile in its
`getLegalMoves` reach (current position included), passes the **same**
gate the engine enforces in `validate.ts`: the distance check (with the bow
height-range bonus) **plus** the `rangeMode` LoS/arc check —
`straight_line` requires `hasLineOfSight` (a barrier breaks it), `arc`
requires `arcTargetable` (lobs over intermediate obstructions — a barrier
does **not** block it), `melee` adds no sightline check. Because the gate
reads the passed `state`'s map, a hypothetical elevation- or
barrier-mutated state recomputes correctly through the identical code path
— the three-resolver discipline the brief demands, no parallel
approximation that can drift from the live map.

**Note:** the AI's *existing* offensive range check (`positionInAbilityRange`
in `basic.ts`) uses distance only and ignores LoS/arc. The coverage map is
therefore strictly more faithful. We deliberately did **not** retrofit the
offensive path (out of scope; would churn S20b behavior) — the map is the
honest reach, the offensive scorer keeps its cheaper approximation.

### 2. melee vs. ranged is tagged by effective horizontal reach, not rangeMode

A true melee swing reaches 1 (adjacency), vertical 3 — elevation-defeatable:
the honest range check already drops it from a tile more than 3 levels above
the attacker, so the "above-melee-reach" safety the defensive term wants
falls out of the geometry with **no separate nullification step**. Reach > 1
is `'ranged'`. This matters because a **Longbow leaves `attack` at
`rangeMode: 'melee'`** while extending its reach to 5 (vertical 99) — so
`rangeMode` would mis-tag a bow shot as melee/elevation-escapable; effective
reach classifies it correctly as ranged, never height-escapable (the brief's
"mis-tagging a ranged attacker as melee" watch-for).

### 3. Damage is projected against a repositioned occupant, in the offensive currency

`expectedDamage` reuses the shared `projectExpectedDamage` resolver with the
attacker hypothetically on its firing tile and the queried occupant
hypothetically on the queried tile — so elevation effects (downhill
`height_delta` bonus, evasion's elevation modifier, height-range) reflect
the hypothetical engagement, and the value composes with offense without a
unit mismatch. Per (enemy, attack) the stored value is the **max over the
enemy's reachable firing tiles** — a worst-case read appropriate for a
safety model. Hit chance is folded in (EV; no `noEvasion`).

### 4. Scope: damage-dealing attacks only; current-turn enemy positions

The map enumerates only affordable **damage** attacks (non-healing
`effects.damage`). Debuff-only appliers (Magnetic Mark, etc.) are real
threats but deal no damage, so they add nothing to the incoming-damage model
the v1 consumers read — deferred. Enemy reach is computed from where each
enemy stands now (Layer-2 deferral).

### 5. Caching

The map is a pure function of `(state, catalog, occupant)`. v1 computes it
once per consumer pass and threads it through; the immutable-state identity
makes a `WeakMap<GameState, …>` memo a safe future optimization if the
Move-then-Act re-call cost shows up. Barrier denial uses the single-tile
`threatsToTile` rather than rebuilding the whole map per candidate wall.

## Consequences

- The three S59 consumers query one honest, board-relative threat model;
  hypothetical (elevation/barrier) queries route through the same pure
  computation as the live map.
- **A v1-content nuance for Barrier denial (flagged for the consumer
  build):** there is currently **no `straight_line` damage ability** (only
  `taunt`, non-damage) — all ranged damage is `arc` (lobs over walls) and
  melee skips LoS. So a barrier's *measurable* denial in current content is
  **pathing-delta** (it severs the approach, shrinking each enemy's
  `getLegalMoves` reach — verified by a test) — the LoS-delta machinery is
  present and correct but inert until straight-line attacks exist. This does
  not change the foundation.
- Perf: the headline risk. The full-map build is
  `enemies × reachable-tiles × attacks × map-tiles` reach checks, projection
  only on hits. Cheap on v1 maps; watch turn latency on a full Terraformer
  battle (logged in `playtest-watch.md`), and Barrier's per-candidate
  single-tile rebuild is the worst case to bound when that consumer lands.
- Tests: 12 in `src/ai/threat/coverage-map.test.ts` (reach, reach-bound,
  melee/ranged tagging, the elevation gate both ways, hypothetical
  elevation + barrier recompute, builder agreement, empty/KO edges).
  1680 → 1692.

## Deferred

- Layer-2 positional prediction.
- Debuff-only threat modeling.
- Retrofitting LoS/arc fidelity into the offensive range scorer.
- The `WeakMap` cross-call memo (until perf signal warrants it).
