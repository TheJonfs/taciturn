## ADR-0098: Barrier denial (Worldcraft Tier B — net coverage-delta scorer)

**Status:** Accepted
**Date:** 2026-06-10

## Context

The threat coverage map (ADR-0094) was built with four consumers in mind. Three
shipped in S57/S59 (defensive term, perch, revert-traps). The fourth Tier B
consumer — **Barrier denial** — was deferred twice: it needs line-of-sight to
*mean* something, and until the S60 arc→straight_line cut (ADR-0097) every ranged
damage attack lobbed over walls, so a barrier's LoS-blocking lever was inert. With
seven spells now `straight_line`, a barrier can break a real shot, so the AI
Terraformer can screen a threatened ally with a wall. This is that scorer.

## Decisions

### 1. Net coverage-delta, not ally-protection-only (D4)

A barrier is **impassable and sight-blocking for both teams**. Scoring only the
protection it gives an ally would wall the AI's own units in / block their own
shots. So a candidate barrier is scored as a **net**:

- **Gain** = `max(0, incomingTo(ally, live) − incomingTo(ally, withBarrier)) ×
  killValue(ally)` — the reduction in expected incoming damage to the protected
  ally (`threatsToTile` live vs. the barrier-mutated board). Captures both the
  LoS-delta (a `straight_line` shot broken) and the pathing-delta (a melee
  approach severed — barrier tiles are impassable in `getLegalMoves`).
- **Cost (self-obstruction)** = `Σ_enemies max(0, threatToEnemy(AI team, live) −
  threatToEnemy(AI team, withBarrier)) × killValue(enemy)` — the AI team's own
  lost offense. Measured by the *same* resolver with `occupant` flipped to each
  enemy, so "enemies-of-occupant" resolves to the AI team: the drop in the AI
  team's reach-and-hit to an enemy is the AI's lost offense.
- **Net = Gain − Cost.** A barrier can only *reduce* reach (it never creates a
  path or a sightline), so both deltas are one-signed; `max(0, …)` is just a
  guard. A wall that shields a squishy scores; an empty wall ≈ 0 and never
  enters the pool; a wall that mostly severs the AI's own kill shot goes negative
  and is declined.

No separate self-obstruction logic — the symmetric `threatsToTile` is the whole
mechanism (the three-resolver discipline: validate.ts, the coverage map, the
offence projection, and now denial all read the same reach/LoS path).

### 2. `withBarrier` — the hypothetical-state helper (it did not exist)

The S59 brief assumed `withBarrier` was already built. It was not — ADR-0094 only
made the coverage map *queryable on* a barrier-mutated state (`threatsToTile` is
pure over the passed `state`; `canReachAndHit` reads `state.map`; barriers live as
`tile.barrier`), but no helper *constructed* one. `withBarrier(state, line)` (in
`basic.ts`, mirroring `withElevationChanges`) clones `state.map.tiles` and sets a
barrier on the line's tiles. Only **presence** matters to the threat model
(`hasLineOfSight` reads `tile.barrier !== undefined`; pathfinding treats the tile
impassable), so a minimal `BarrierState` (`{ hp: 1, ttl, ownerId }`) suffices for
scoring — hp/ttl/owner don't affect reach geometry. Pure, scoring-only.

### 3. Bounded candidates — perf is the headline (D5)

Per-candidate `threatsToTile` recomputes (each an enemy-set Dijkstra) are the cost
centre. The bound:

- **Protect one ally** — the AI's most-threatened living unit (the actor
  included), by live incoming. v1 scope; multi-ally protection deferred.
- **≤12 candidate lines** — four cardinal "screens" (a perpendicular line one
  tile beyond the ally on N/S/E/W, centred) × lengths {3,4,5}. Intentional walls
  that actually screen, not a full in-range sweep. `canCommitAction` prunes
  illegals (range / occupancy / barrier-free / on-map).
- **Lazy two-stage** — every legal screen gets the cheap *gain* pass (one
  `withBarrier` recompute against the single protected ally); only the **top-3
  gainers** pay the expensive per-enemy *cost* pass. Bounds the costly recompute
  to ~3 candidates.

Measured: ~**2 ms** per Terraformer decide on a 4v4 — far under the ~1s baseline.
A known redundancy (the per-enemy cost loop rebuilds the AI-team Dijkstra per
enemy for a fixed hypothetical) is left for a follow-up team-keyed cache if a
larger board ever makes it bite; the shortlist bound keeps it cheap for now.

### 4. Reactive only — no speculative walls

When no ally faces incoming threat, `mostThreatenedAlly` returns null and no
candidate is produced. Barrier denial is purely *reactive* protection in v1 — no
board-control / lane-denial zoning (which would need a different heuristic).
Consistent with the fall scorer declining flat ground.

### 5. No score damp; competes in the unified pool

Unlike the perch (a *future*-payoff raise, damped by `PERCH_DAMP`), a barrier's
protection is *immediate*, so it competes on its true net value — like the fall
scorer. It's pushed into the unified candidate pool (ADR-0092) at the Worldcraft
site, so a barrier wins only when its net protection beats attacking / healing /
the other Worldcraft works.

## Consequences

- The AI Terraformer now builds walls to protect a threatened ally when the net
  protection is positive, and declines when it isn't (empty wall, self-walling,
  or an arc threat that lobs over). The fourth coverage-map consumer is shipped.
- **Browser/playtest verification is human-only** (the harness can't drive AI
  battles). Watch the *feel*: does the AI wall sensibly without trapping its own
  units, and is think-time acceptable on a full Terraformer battle? See
  `playtest-watch.md`.
- Tests: +5 in `session-61-barrier-denial.test.ts` (screens a threatened ally on
  the sightline; declines no-threat; declines net-negative self-walling; declines
  ineffective adjacent-melee wall; declines an arc threat). 1716 → 1721.
- AI-only change — **no player-facing entry** in `guide-changelog.md` (a "no
  player-facing changes" stub records the session as processed).

## Deferred / dials

- **Role-aware deployment sorting** — the coverage map's 4th-and-final intended
  consumer is now the clean next item (this was the *fourth Tier B* consumer; the
  deployment sorter is the remaining one).
- Multi-ally protection; speculative / zoning walls; a team-keyed Dijkstra cache
  if perf bites on large boards.
- Candidate enumeration richness (offset-2 screens, diagonal threats) if playtest
  shows the cardinal screens missing good walls.
