# Session 59 Brief: Threat Model + Consumers (defensive term · Barrier denial · Tier C v1)

## Context

S57 fixed the scorer foundation (unification, ADR-0092) and shipped Worldcraft Tier A + Tier B-perch on top. S59 builds the **next keystone — the incoming-threat / danger model** — and the consumers that ride it. Same foundation-then-consumers rhythm: build the substrate, then the features.

**The threat model has two layers (blueprint §3); only Layer 1 is built here.**
- **Layer 1 — coverage map.** "Which enemies can reach-and-hit tile X next turn, tagged melee vs. ranged." A pure function of board state, cached per turn, **queryable on hypothetical states** (the `withElevationChanges` pattern from S57 generalizes to barrier-inserted states). This is the keystone.
- **Layer 2 — positional prediction** ("where will an enemy actually *be*"). **Deliberately deferred** (Chris's call): no multi-turn forecasting. Consumers evaluate against positions as they stand this turn.

**Consumers this session:**
- **Defensive above-melee-reach term** (blueprint §4.1.2) — the simplest consumer; validates the map.
- **Barrier denial** (Tier B's deferred half) — the heaviest; needs the map on hypothetical barrier-inserted states (pathing-delta + LoS-delta).
- **Tier C v1 (revert-traps)** — **decoupled from the map.** With current-state evaluation, a revert fires on the AI's own over-cap cast, so "who rides the tile when it reverts" = who's on it *now*. Needs only the FIFO queue + current footprint occupancy + the existing Tier A fall scorer + a never-drop-ally guard. Cheap, independent add.

**Out of scope:** role-aware deployment sorting (the map's eventual 4th consumer — stays a carry); speculative trap-laying; all Layer-2 prediction.

Scope: **Large.** Foundation + up to three consumers; the audit confirms whether all fit.

## Inputs (read first)

1. **`CLAUDE.md`** — conventions.
2. **Blueprint** — §3 (threat model, the four consumers, foundation-then-consumers rhythm), §4.1.2 (defensive term, melee vertical reach = 3), §5 (Worldcraft mechanics, FIFO, fall rule).
3. **`docs/decisions/0092`** (unification — the scored candidate pool consumers plug into) and **`0093`** (Tier A fall scorer + `withElevationChanges` + perch).
4. **Building blocks (audit how they compose):** `projectUpcoming`, per-unit `getLegalMoves`, `withElevationChanges`, `src/engine/effects/queue.ts` (FIFO `queue.shift()`), `bestWorldcraftFallCandidate` (the Tier A fall scorer).
5. **Line-of-sight system** (path TBD) — for Barrier sight-blocking; may not exist.

### Paths to survey before planning

- **T1 — Coverage-map composition + cost.** How do `projectUpcoming` / `getLegalMoves` compose into "reach-and-hit tiles per enemy"? What's the per-turn cost over all enemies? This sizes the foundation and is the headline perf risk (the handoff already flagged Worldcraft enumeration cost).
- **T2 — Melee/ranged classification.** Can each enemy's attack be tagged melee (elevation-defeatable) vs. ranged (not)? The defensive term is meaningless without this tag.
- **T3 — Hypothetical barrier states.** Confirm `withElevationChanges` generalizes to "barrier inserted." How is a barrier represented in a hypothetical board — blocks pathing *and* LoS? Sizes Barrier denial.
- **T4 — LoS system.** Does one exist (for "barrier blocks sight"), or is it net-new? If absent, Barrier denial v1 may be pathing-delta only, LoS-delta deferred.
- **T5 — Tier C reuse.** Confirm the Tier A fall scorer can be invoked on a *revert* (eviction) the same way as on a cast; confirm the queue exposes which work is oldest/evictable and that current footprint occupancy is readable.
- **T6 — Caching.** The coverage map is a pure function of board state → compute once per turn, cache, all consumers query the cache. Barrier denial recomputes per candidate barrier (map × candidates) — confirm whether an incremental/local update is feasible or candidate enumeration must be bounded.

## Goal

**Coverage map (foundation):**
- Pure, cached per turn, melee/ranged tagged, queryable on hypothetical (elevation- and barrier-mutated) states.

**Defensive term:**
- A move destination **above the melee vertical reach (3)** of enemies that could otherwise melee it scores safer (reduced expected incoming melee). Ranged threat is **not** discounted by elevation.
- Composes into the same move-destination scoring as the S56 offensive term; weighted by its own dial, set conservatively.

**Barrier denial:**
- A Barrier that measurably cuts an enemy's reach and/or LoS to a vulnerable ally scores; one that walls nothing scores ~0. Sophistication per T3/T4.

**Tier C v1 (revert-traps):**
- Values triggering a revert (over-cap cast, or same-turn raise-then-evict) that drops an enemy currently on the revert footprint, using the Tier A fall computation.
- **Never drops an ally** (current-occupancy guard over the footprint).
- No speculative trap-laying; no movement prediction.

**Quality:**
- Tests +TBD (per-consumer below).
- ADRs: coverage map likely its own; consumers possibly each. Plan-review decides.
- `docs/handoff.md`, `docs/playtest-watch.md` updated.
- Vercel pre-flight.
- **Browser verification human-only** (PixiJS harness constraint) — does the AI take safe high ground, wall off threats, and spring revert-traps sensibly? Log watch entries.

## Pre-implementation plan

Audit-first. **Build the coverage map first; plan-review checkpoint before consumers.** Then consumers in priority order.

### Required first step: current-tree audit

Per "Paths to survey." Deliverables:
1. **Coverage-map composition + cost (T1, T2, T6)** — how the blocks compose, the per-turn cost, the caching strategy. *Sizes the foundation.*
2. **Barrier hypothetical-state + LoS (T3, T4)** — generalizes `withElevationChanges`? LoS exists? *Sizes Barrier denial.*
3. **Tier C reuse (T5)** — fall scorer on revert; queue/occupancy readable.
4. **Recommended consumer set + order**, ratified at plan-review.

### Architectural decisions (provisional — audit-gated)

- **Coverage map:** a pure, per-turn-cached structure mapping tiles → threatening enemies (with melee/ranged tag and projected damage). Built from `getLegalMoves` × attack ranges per enemy. All consumers query the cache; hypothetical queries recompute on mutated state.
- **Defensive term:** for a candidate destination, query the map for enemies threatening it; nullify the melee component where `destinationElevation − attackerElevation > 3`; the residual (ranged + un-nullified melee) is expected incoming damage, reducing the destination score. Same move-scoring surface as the S56 offensive term.
- **Barrier denial:** score a Barrier by the coverage-delta to a protected ally between board-without-barrier and board-with-barrier (pathing-delta always; LoS-delta if T4 supports). Bound candidate barriers per T6.
- **Tier C v1:** reuse `bestWorldcraftFallCandidate`'s fall computation on the evicted raise's footprint; value enemy occupants, hard-veto ally occupants. Independent of the coverage map.

### Decision points

- **D1 — Consumer priority / split.** Floor = coverage map + defensive term (validates the foundation with the simplest consumer). Then **Tier C v1** (cheap, map-independent) and **Barrier denial** (heavy). Recommend Tier C v1 before Barrier — it's lower-risk and doesn't wait on the map. Audit confirms whether all three fit. *Confirm.*
- **D2 — Deployment sorting out of scope.** The map's 4th consumer stays a carry; building the map with its eventual needs in mind, but not wiring deployment this session. *Confirm.*
- **D3 — Barrier denial v1 sophistication.** If T4 finds no LoS system, ship pathing-delta only (block-the-approach), defer LoS-delta. *Gated on audit.*
- **D4 — Tier C occupancy.** On-tile current occupancy of the revert footprint (1 for Pillar, 3×3 for Hill) — the only units a revert-fall affects. No adjacency, no prediction. *Confirm the footprint-occupancy framing.*

## Implementation work

Foundation first, then consumers per D1.

### 1. Coverage map (foundation)
- Build per-enemy reach-and-hit tiles (melee/ranged tagged) from `getLegalMoves` × attack ranges; aggregate into a tile→threats map; cache per turn; support hypothetical recompute.
- Tests: known board → correct threatened tiles; melee vs. ranged tagged; hypothetical (elevation/barrier) recompute correct. ~10-15 tests.

### 2. Defensive term (consumer, floor)
- Query map in move-destination scoring; nullify elevation-defeated melee; reduce score by residual incoming damage; weight dial conservative.
- Tests: destination above melee reach of a melee threat scores safer; ranged threat not discounted by height; mixed threats; no regression to the S56 offensive term. ~8-12 tests.

### 3. Tier C v1 (consumer, cheap/independent)
- Reuse fall scorer on the evictable raise's footprint; value enemy riders; veto ally riders; score the triggering cast accordingly.
- Tests: opportunistic revert onto an enemy scored; same-turn raise-then-evict scored; ally on footprint → vetoed; empty footprint → no value; no speculative laying. ~8-12 tests.

### 4. Barrier denial (consumer, heavy)
- Coverage-delta to a protected ally with a hypothetical barrier inserted; pathing-delta (+ LoS-delta per T4).
- Tests: barrier that cuts an approach to a squishy scores; barrier that walls nothing scores ~0; (LoS cases if built). ~10-18 tests.

### Tests (total)
~36-57 across the four; single-session subset depends on D1.

## Acceptance criteria

- **Coverage map:** correct, cached, tagged, hypothetical-queryable (unit-tested).
- **Defensive term:** safe high ground preferred against melee, not against ranged (unit-tested + playtest-logged).
- **Tier C v1:** revert-traps spring on current enemy riders, never on allies (unit-tested + playtest-logged).
- **Barrier denial (if it lands):** real denial scored, empty walls not (unit-tested); else cleanly deferred.
- **Quality:** tests green; ADR(s) per plan-review; docs updated; Vercel clean; human-playtest watch entries.

## Out of scope

- **Role-aware deployment sorting** — the map's 4th consumer; carry.
- **Layer 2 positional prediction** — no multi-turn forecasting.
- **Speculative trap-laying** (raise an empty tile hoping an enemy climbs on).
- **Worldcraft move-then-cast planning** — deferred (perf; standing item).
- **Full killValue-weighted Math re-base** — standing item.
- Standing carries (templates, Move-tier discussion, cosmetic items, etc.).

## Files likely touched

Non-exhaustive; audit confirms.
- New threat-model / coverage-map module (`src/ai/` — path TBD).
- AI move-scoring (`src/ai/`) — defensive term (alongside the S56 approach term).
- AI Worldcraft scoring — Barrier denial; Tier C revert path (reusing `bestWorldcraftFallCandidate`).
- LoS module — if Barrier LoS-delta is built (T4).
- `src/test/session-59-*.test.ts` (split per consumer).
- `docs/handoff.md`, `docs/playtest-watch.md`, ADR(s) in `docs/decisions/`.

## Workflow notes

- **Plaintext-first review required.**
- **Coverage map first; plan-review before consumers.** The map's shape (T1/T2/T6) and the LoS finding (T4) set the consumer scope.
- **Consumer order:** defensive term (floor) → Tier C v1 (cheap) → Barrier denial (heavy).
- **Browser verification human-only**; log watch entries.
- **Vercel pre-flight discipline.**
- **Mid-session design questions** route through Chris. Likely surfaces: Barrier sophistication if no LoS system (D3); the defensive-term weight dial; whether the map warrants its own ADR (it should).

## Watch-fors

**Addressed this arc:** the threat model and three of its four consumers; the defensive term and Barrier denial that were blocked on it; Tier C.

**Carry-forward:** role-aware deployment (the 4th consumer, now unblocked for a later session); Layer-2 prediction (if ever wanted); standing carries.

**Specific to this session:**
- **Perf is the headline.** The coverage map is computed over all enemies × reachable tiles × attack ranges, on top of the existing Worldcraft enumeration. Per-turn caching is mandatory; Barrier denial's per-candidate hypothetical recompute is the worst case — bound candidates or find a local update. Watch turn-evaluation time hard.
- **Never-drop-ally guard (Tier C).** A revert-trap that drops the AI's own unit is a serious own-goal. The veto must be a hard gate, test-covered, including the Hill 3×3 footprint catching a mixed friend/enemy cluster.
- **Defensive term over-valuing height.** It must not pull units onto safe-but-useless peaks (the S56 conditional lesson, defensive side) — safety only counts against *actual* melee threat in the coverage map, not as a flat elevation bonus. And it must not double-count with the S56 offensive term.
- **Three-resolver / hypothetical-state discipline.** Coverage on hypothetical states (elevation, barrier) must route through the same pure computation as the live map — no parallel approximation that can drift.
- **Ranged/melee tag correctness.** Mis-tagging a ranged attacker as melee would let the AI "hide" on high ground from a threat that still hits it. Test the tag boundary.

## Estimated size

**Large; the audit sets the consumer set.** Probable shape: **coverage map + defensive term + Tier C v1** as the achievable core (the map plus its cheapest and its independent consumer), with **Barrier denial** as the heavy consumer that fills remaining budget or slips to a follow-up — especially if T4 finds no LoS system and LoS-delta would be net-new.

**Split contingency:**
- Floor: coverage map + defensive term (foundation validated by its simplest consumer).
- Tier C v1: cheap and map-independent — keep unless budget is dire.
- Barrier denial: first to slip; pathing-delta-only fallback if LoS is net-new.
