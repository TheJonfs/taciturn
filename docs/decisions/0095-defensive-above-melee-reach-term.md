## ADR-0095: Defensive above-melee-reach term (first coverage-map consumer)

**Status:** Accepted
**Date:** 2026-06-10

## Context

The S59 brief's floor consumer of the threat coverage map (ADR-0094): a move
destination "above the melee vertical reach (3) of enemies that could
otherwise melee it scores safer; ranged threat is not discounted by
elevation." It validates the map with the simplest consumer and gives the AI
the long-missing "take safe high ground" behaviour (the Hunter-won't-take-
Stonebridge canary, defensive side).

## Decisions

### 1. Safety is a tie-break, not a score penalty

The first implementation subtracted `WEIGHT × expectedIncoming(tile)` from
each plan's score. It **broke engagement**: in the symmetric demo battle the
penalty pushed attack plans below the commit threshold, both sides declined
to engage, and battles failed to decide within 1000 steps — the brief's
"passivity / tempo-bleed" watch-for, made concrete (and the AI-vs-greedy
integration test caught it).

So the term is applied as a **tie-break**: offence decides *whether* and
*what* to attack — and how the attack competes against heals / items /
Worldcraft in the unified pool (ADR-0092) on its undiscounted value — while
residual danger only chooses *which of two equal-offence tiles* to attack
from. The joint planner ranks plans `offence → lower danger → lower move-cost
→ lex-id`. This can never suppress an attack, so engagement is preserved,
yet a mage with two equally-good cast tiles still picks the one out of melee
reach (and a unit backing out of melee to cast does so without losing the
attack — the move leg is same-turn).

This is the conservative end of the "defensive-term weight dial" the brief
anticipated. A weighted score-reducing form (safety able to outweigh some
offence) is the future lever if playtest shows the AI ignoring safety; logged
in `playtest-watch.md`.

### 2. Neutralised-threat discount

A plan's residual danger **excludes any enemy the plan would KO** — a dead
enemy poses no incoming threat, so the AI doesn't side-step an enemy it is
about to kill (without this, a one-shot-in-place lost to a "dodge" move).
v1 scope: a single unit-targeted lethal attack (`planKoTargetId`, expected
damage ≥ target HP); AoE / multi-kill neutralisation deferred.

### 3. Safe high ground falls out of the geometry

No separate "nullify melee above reach 3" step: the coverage map's reach
honours melee vertical range, so a tile above a melee threat carries no melee
entry and is simply less dangerous. Ranged threat (vertical 99 bows,
straight-line/arc) stays in the map regardless of height — "not discounted by
elevation" for free. The melee/ranged tag is by effective horizontal reach
(reach 1 = melee), so a Longbow (reach 5, `rangeMode: 'melee'`) is correctly
ranged.

### 4. Dual insertion point

The term lives in **both** move-aware scorers: the joint planner
(`pickJointActOrMove`, primary — choosing the attack tile) and the
distance-closing fallback (`pickBestMove`, where danger is a tie-break
*below* distance so advancing toward the enemy is never sacrificed for
safety). The fallback rarely has danger to act on (it's reached only when no
attack is possible this turn) but stays consistent.

### 5. Perf: the coverage map is bounded and projected once per attack

The defensive build is bounded to the actor's reachable destinations (one
extra actor-Dijkstra vs. sweeping the whole board), and each enemy attack's
expected damage is projected **once per build** at current positions and
reused for every tile it reaches (ADR-0094). Re-projecting per (source, tile)
made the AI-vs-greedy integration test flake against vitest's 5 s timeout
under load; the precompute brought it back to ~3 s and the full suite to its
baseline ~14 s. Per-tile elevation accuracy of the damage *magnitude* is
traded away (reach geometry stays exact); acceptable for a tie-break and
consistent with Layer 1 (enemy evaluated where it stands).

## Consequences

- The AI prefers safe attacking positions (kites out of melee to cast, takes
  above-reach high ground) without ever declining to engage — verified by 8
  tests in `session-59-defensive-term.test.ts` (residual-danger mechanics +
  the discount + the kite/kill-in-place/exposed-engage/inert behaviours) and
  the unchanged AI-vs-greedy integration suite.
- Offensive-logic tests that placed the actor next to melee threats now
  isolate offence from safety (enemies relocated out of reach, or `pa 0` for
  clustered AoE targets) so they still test the choice they were written for.
- **Browser verification is human-only** (PixiJS harness): does the AI take
  safe high ground against melee, not against ranged, without dithering?
  Watch entries in `playtest-watch.md`.
- 1692 → 1700 tests.

## Deferred / dials

- A weighted score-reducing form (the stronger dial) if playtest shows safety
  under-valued.
- AoE / multi-target neutralised-threat discount.
- Per-tile elevation accuracy of danger magnitude.
