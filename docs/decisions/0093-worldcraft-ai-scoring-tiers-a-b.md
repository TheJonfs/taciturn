## ADR-0093: Worldcraft AI scoring — Tier A (fall) + Tier B (perch)

**Status:** Accepted
**Date:** 2026-06-08

## Context

Following the S57 scorer unification (ADR-0092), the AI was taught to *use*
the Terraformer's Worldcraft works, which the audit found it ignored entirely
(the five works are `tile`/`tile_set`-targeted with an `effects.worldcraft`
payload, so the offensive enumerator rejected them; `tile_set` was handled
nowhere). The session brief
(`docs/thirtyNinePlanning/session-57-worldcraft-ai-brief.md`) scoped three
tiers: A (Pit/Valley fall damage), B (Pillar/Hill perch + Barrier denial),
C (revert traps, gated on a threat model). This ADR records the Tier A + B
decisions; Tier C and the threat model remain S59.

## Decisions

### 1. Worldcraft works are scored as current-position pool candidates

Worldcraft casts enter the unified candidate pool (ADR-0092) as
**current-position** candidates (like heals/items/Math), *not* through the
per-destination joint planner. Routing tile-targeted casts × footprint
occupancy through every reachable move destination would multiply the
already-flagged enumeration cost badly. Trade-off: no "move-then-cast"
planning for Worldcraft in v1 — a deliberate boundary. (A Terraformer that
must reposition to reach a target casts next turn instead.)

### 2. Tier A fall scoring reuses the engine's own terrain primitives

`scoreWorldcraftFall` reuses the exported, pure `buildElevationChanges`
(single source of truth with `reduceSystemTerrainChange`) and the shared
`FALLING_DAMAGE_PER_LEVEL` + `> 1` gate from `fall-damage.ts`. Per footprint
tile, the pre-change occupant's drop is scored `±dmg × killValue`: enemies
positive, allies/self penalized by `FRIENDLY_FIRE_PENALTY_FACTOR`, KO'd
occupants ignored. This keeps the AI's fall math identical to the engine's by
construction — no parallel rule to drift. Only net-lowering works (Pit,
Valley) score here; raises deal no immediate fall damage.

Engine-API additions for the AI tier: `buildElevationChanges` (abilities
barrel), `FALLING_DAMAGE_PER_LEVEL` / `fallDamageAction` (map barrel).

### 3. Tier B perch v1 = "lift-in-place"

`bestPerchCandidate` values raising the tile a **height-seeking ally already
stands on** (bow user, `isHeightSeeker`), scoring the improvement to its best
projected shot at the priority target on a hypothetical raised-terrain state
(`withTerrainChanges`/`withElevationChanges` + the range-relaxed
`strongestDamageFollowUp`), discounted by `PERCH_DAMP = 0.5`.

This is a **strict subset of the single-move horizon** (D2): the ally reaches
the perch in zero moves. It deliberately defers the "ally moves onto a
created perch" case, which needs hypothetical-reachability + jump-climb
validation — and would otherwise risk the brief's "AI gifts an unreachable
perch" failure mode. Lift-in-place cannot gift an unreachable or
enemy-exploitable perch by construction (only allied height-seekers already
on a raised tile are valued). Steal-risk modeling is ignored per D3.

### 4. Barrier denial deferred to S59

Building Tier B, grounding revealed that a useful Barrier denial heuristic
("does this wall stop enemy E reaching/shooting ally A") is **threat-model
logic** — it needs the "which enemies can reach/hit a given tile" reasoning
that S59's threat model builds. A heuristic now would be largely throwaway
work S59 replaces. Per Chris's call, Barrier folds into S59 alongside the
threat model (and Tier C, which shares it). The `withElevationChanges`
hypothetical-state substrate built for perch generalizes to the
barrier-inserted case S59 will need.

### 5. validateAction off-map bounds check (S7)

`validateAction` now bounds-checks before `tileAt` in the `tile` and
`tile_set` branches, so an AI-generated off-map Worldcraft target near a map
edge reads as invalid instead of throwing `OutOfBoundsError` (ADR-0002).
Folded in here because the AI emitting tile sets makes the latent flag live.

## Consequences

- The Terraformer's destructive works are now competent: the AI drops
  clusters/high-ground enemies with Pit/Valley, declines flat ground, avoids
  friendly Valleys, and lifts its archers for the height bonus — all in the
  same currency as attacks (a Pit loses to a better attack, wins when it does
  more expected good).
- **Browser verification is human-only** (the harness can't drive AI
  battles); Worldcraft AI behavior needs a human playthrough. Watch entries
  logged in `docs/playtest-watch.md`.
- Decisions ratified at plan-review: D1 (Tier A immediate fall only) and D2
  (perch single-move horizon, narrowed to lift-in-place for v1) confirmed;
  D3 (ignore steal-risk) and D4 (Barrier → defer to S59, updated from
  "heuristic first" after the grounding finding above).

## Deferred (S59)

- Barrier denial scoring (with the threat model).
- Tier C revert-traps (FIFO queue lookahead + threat model).
- Perch "move onto a created perch" (hypothetical-reach + jump-climb).
- Worldcraft move-then-cast planning (the enumeration-cost boundary).
