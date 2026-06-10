## ADR-0096: Tier C revert-traps (Worldcraft AI, eviction-triggered falls)

**Status:** Accepted
**Date:** 2026-06-10

## Context

The last of the Worldcraft scoring tiers (blueprint §3 Tier C). A Terraformer
holds a bounded FIFO queue of cast effects (`Unit.worldcraftEffects`, cap via
`computeWorldcraftEffectCap`, ADR-0088). At cap, the next cast evicts and
*reverts* the oldest entry; reverting a **raise** (Pillar/Hill) drops whoever
rides its footprint for fall damage. Tier C teaches the AI to value
triggering that revert when an enemy is riding the trap.

Per the S59 brief, Tier C is **decoupled from the coverage map**: with
current-state evaluation a revert fires on the AI's own cast, so "who rides
the tile when it reverts" is just "who's on it *now*." It needs only the FIFO
queue + current footprint occupancy + the Tier A fall computation + a
never-drop-ally guard.

## Decisions

### 1. Value the eviction the next cast would trigger; spring with a harmless raise

`bestRevertTrapCandidate` reads the actor's effect queue and the cap. If a new
cast would evict (`queue.length + 1 > cap`, mirroring `enqueueWorldcraftEffect`'s
oldest-first front eviction), it scores the revert's fall over the evicted
entries' **current** footprint occupants. The candidate's action is a
**pure-raise trigger** (`firstValidRaiseCast` — Pillar/Hill, which deal no
fall on cast), so committing it springs the older loaded trap via the FIFO
eviction without the trigger itself harming anyone. This is the brief's
"same-turn raise-then-evict" path. A Pit/Valley trigger is excluded — it would
drop its own occupants and could catch an ally.

### 2. Never drop an ally — a hard veto

`scoreRevertDrop` returns `null` (veto, candidate suppressed) if **any** ally
rides a dropping footprint tile (`newElevation − originalElevation ≥ 1`), even
on a corner that deals no damage. Enemy fall value counts only where the drop
clears the engine's `> 1` fall-damage gate (`FALLING_DAMAGE_PER_LEVEL × drop ×
killValue`), reusing the Tier A fall rule by construction. The Hill 3×3
mixed-cluster case (enemy + ally on the same reverting footprint) vetoes — the
AI never own-goals to catch an enemy. Test-covered as a hard gate.

### 3. Opportunistic only — no speculative trap-laying, no prediction

Tier C fires only when the actor is **already at cap** and an enemy is
**already** on the evicted raise's footprint **now**. It does not raise an
empty tile hoping an enemy climbs on (speculative laying, out of scope) and
does not predict movement (current occupancy only, D4). An empty footprint, a
sub-cap queue, or an unaffordable/illegal trigger all yield no candidate.

### 4. Competes in the unified pool on its fall value

The candidate's score is the revert's enemy-fall value, in the same
expected-damage currency as every other pool entry (ADR-0092) — so springing a
trap competes with attacks, heals, Pit/Valley, and perch, and wins only when
it does the most good. Independent of the coverage map (ADR-0094).

### Engine-API addition

`computeWorldcraftEffectCap` (and the rest of the effect-queue surface) is now
exported from the engine barrel via a new `src/engine/effects/index.ts`, so
the AI reads the cap through the single source of truth (respects Expert
Former) — the same "expose primitives for the AI tier" pattern as ADR-0093.

## Consequences

- A Terraformer at cap with an enemy riding an older Pillar/Hill will cast a
  harmless raise to evict it and drop the enemy — and will refuse when an ally
  shares the footprint.
- **Browser verification is human-only** (PixiJS harness): does the AI spring
  revert-traps at sensible moments and never drop its own units? Watch entry
  in `playtest-watch.md`.
- Tests: +9 in `session-59-tier-c-revert-traps.test.ts` (fall value, the
  ally/mixed-cluster veto, empty + sub-gate zero, cap gating, the trigger
  candidate, and a `decideBasicAi` spring). 1700 → 1709.

## Deferred

- Multi-entry eviction value beyond the single oldest (only relevant if a cast
  could evict >1, which the current cap arithmetic doesn't produce).
- Speculative trap-laying and movement prediction (Layer 2) — out of scope by
  design.
- Crediting the trigger raise's own perch value in the same candidate (the
  perch candidate covers it separately; no double-count).
