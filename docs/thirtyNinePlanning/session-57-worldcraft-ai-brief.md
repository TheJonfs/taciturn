# Session 57 Brief: Worldcraft AI Scoring (Tiers A/B/C — audit scopes the split)

## Context

S56 laid the positional substrate (ADR-0091) and validated it in playtest. The arc continues into Worldcraft AI scoring — teaching the AI to *use* the Terraformer's five works (and cross-class Worldcraft) rather than ignore them. Per Chris's call, **all three tiers are scoped in this one brief and the audit sets the session boundaries** — a pre-commitment to "three sessions" or "one session" would be guessing; the substrate survey decides.

**The unifying substrate:** every Worldcraft work is **tile-targeted**, and the existing scorer scores *ability-on-target-unit*. So the spine of this whole arc is **tile-targeted offensive cast enumeration** — enumerate candidate target tiles, resolve footprint occupancy, score signed per-occupant value. Tier A is the simplest payload on that spine (immediate damage); B and C add positional and deferred reasoning on top of the same enumeration.

**The tiers (from the blueprint, Section 3):**

1. **Tier A — Pit / Valley as fall damage.** Immediate, occupant-paid harm, scored like an AoE damage ability. The only subtlety is the fall-damage rule (floor-clamped, >1 threshold — Section 5 of the blueprint), which makes per-tile elevation-reading mandatory.
2. **Tier B — Pillar / Hill / Barrier as positional creation.** Perch creation (reuses the S56 positional substrate + the `APPROACH_DISTANCE_FRACTION` dial) and Barrier denial (pathing-delta + LoS-delta — likely net-new).
3. **Tier C — Pillar / Hill as revert-triggered traps.** FIFO cap-queue modeling (mechanic confirmed) + predicting who rides a raised tile at revert. **Hard prerequisite: a threat/turn-prediction model, which does not exist (A4).**

**Dependency structure (the likely seam):**

| Tier | Needs | Substrate status |
|---|---|---|
| A | tile-targeted enumeration; elevation-aware fall projection; AoE friendly-fire | enumeration may exist (Math Skill?); rest small |
| B perch | S56 positional substrate; temperament dial | **exists** |
| B Barrier | pathing-delta + LoS-delta reasoning | likely net-new |
| C | FIFO queue model; **threat/turn-prediction model** | queue exists; **threat model does NOT (A4)** |

A and B are buildable on current/near substrate. **C is gated behind a threat model that A and B don't need** — and that model is reusable (it also unblocks the deferred defensive term and feeds role-aware deployment). So the probable split is **A+B in one session, C bundled with the threat model in another**. The audit confirms or refutes; this brief lays out all three so it can.

Scope: **Large, audit-variable.** Almost certainly more than one session; the audit sets the boundary.

## Inputs (read first)

1. **`CLAUDE.md`** — conventions.
2. **`AI Positional & Worldcraft blueprint`** — Sections 3 (tiers), 5 (mechanical reference + fall rule), 8 (parked work + the `validateAction` flag).
3. **`docs/decisions/0033-*`** (tier-2 scorer / joint planner) and **`0091-*`** (S56 approach-path term) — the scoring contract being extended.
4. **The AI scorer + action enumeration** (`src/ai/` — audit confirms files): `pickJointActOrMove`, `bestActFromSource`, `projectExpectedDamageFromActor`, `strongestDamageFollowUp`, `pickBestMove`.
5. **Calculator Math Skill AI handling** — if Math Skill (tile/AoE-targeted) is already AI-scored, it's the precedent tile-targeted offensive enumeration that Tier A extends. **Key audit anchor.**
6. **`src/content/abilities/worldcraft/`** — the five works (magnitudes, footprints, MP, `tile_set` targeting).
7. **`src/engine/effects/queue.ts`** — FIFO eviction (`queue.shift()`), for Tier C.
8. **Pathfinding + line-of-sight modules** (paths TBD by audit) — for Tier B Barrier and Tier C.

### Paths to survey before planning (this sizes the whole arc)

- **S1 — Tile-targeted offensive enumeration.** Does the AI enumerate tile-targeted AoE *offensive* casts today (via Calculator Math Skill, or any AoE ability)? If yes, Tier A largely plugs in and B/C inherit the enumeration. If no, this arc builds it — the single biggest scoping variable. *Same audit-overturns-spec dynamic as S56; do not presume.*
- **S2 — AoE friendly-fire scoring.** Does the scorer already penalize friendly units caught in an AoE footprint (Pyromancer Fire Storm, healing friendly-fire)? Valley reuses it if so.
- **S3 — Elevation in projection.** Confirm the projection path can read per-tile current elevation to compute `effectiveDrop` for fall damage. (S56 showed height is in the projection for bows; confirm elevation is queryable for arbitrary footprint tiles.)
- **S4 — Fall-damage rule (confirm the blueprint Section 5 model).** `effectiveDrop = min(magnitude, currentElevation)`, clamped at 0, damage only when `effectiveDrop > 1`. Confirm `FALLING_DAMAGE_PER_LEVEL` and the >1 threshold (Chris: "check if the fall is strictly greater than 1"). Confirm Valley corners deal 0.
- **S5 — Pathing-delta + LoS-delta primitives (Tier B Barrier).** Are there reusable "can enemy reach tile X" / "is there LoS from A to B" primitives the Barrier denial scorer can call, or would denial reasoning be built from scratch? Sizes Tier B.
- **S6 — Threat / turn-prediction model (Tier C).** Confirm A4 — no "which enemies can reach/hit this tile next turn" model. If genuinely absent, Tier C splits to a dedicated session bundled with building it. If some partial substrate exists, note what.
- **S7 — `validateAction` off-map `tile_set` throw (blueprint Section 8 flag).** Now live-relevant: the AI enumerating Worldcraft casts near a map edge can generate off-map `tile_set` candidates and trip `tileAt`'s throw. Confirm and fold the one-line bounds check into Tier A.
- **S8 — Item / secondary-skill (Alchemy) scoring commensurability.** *Different area of the chain, but a foundational diagnostic for this whole arc.* Playtest finding: a Knight with Alchemy secondary prioritized crafting/using items over a lethal KO attack — sometimes finishing a fight without ever attacking. So item/Alchemy actions are outscoring `projectedDamage × killValue` for a guaranteed kill, which should sit near the scoring ceiling. **Diagnose how item actions are scored relative to the unified damage scorer** — separate heuristic? mis-scaled constant? craft-step valued independently of use? a pre-emptive "use items" branch outside `pickJointActOrMove`? This tests the assumption the Worldcraft arc rests on: that all action classes are scored in **one commensurable currency**. If they aren't, Worldcraft casts risk the same mis-ranking against attacks. Diagnose here (the implementer is already in the scorer); fix-vs-defer per the fork in Pre-implementation.

## Goal

End state, by tier (which tiers land this session is audit-determined):

**Tier A:**
- The AI enumerates Pit/Valley as tile-targeted casts, scoring each candidate tile by summed signed fall damage over the footprint, using `effectiveDrop` per tile (elevation-aware, floor-clamped, >1 threshold).
- It casts Pit on a worthwhile drop (sufficient elevation, valuable occupant) and **declines a Pit on flat ground** (0 damage).
- Valley scores its 3×3 footprint with the ring pattern, **penalizes friendly units caught in it**, and prefers clusters of enemies on high enough ground.
- `validateAction` no longer throws on off-map `tile_set` (S7).

**Tier B:**
- **Perch:** the AI values casting Pillar/Hill to raise a tile a height-seeking ally can reach and exploit within the S56 single-move horizon (blueprint §4.4), via the existing positional machinery. Weighted by the temperament dial (a turn spent raising must beat acting now).
- **Barrier:** the AI values a Barrier that denies an enemy approach to a vulnerable ally or blocks a meaningful LoS/casting line — at whatever sophistication S5 supports.

**Tier C (likely separate session):**
- The AI models the FIFO cap queue, anticipates which raise reverts on the next over-cap cast, and values a Pillar/Hill whose revert drops an enemy rider — without dropping its own ally. Requires the threat model.

**Quality:**
- Tests +TBD (scenario-heavy; per-tier estimates below).
- ADRs: likely one for the tile-targeted offensive enumeration if S1 finds it net-new; possibly one per tier. Audit + plan-review decide.
- `docs/handoff.md`, `docs/playtest-watch.md` updated.
- Vercel pre-flight.
- **Browser verification needed but human-only** (S56 constraint: the harness can't drive AI battles). Worldcraft AI behavior — does a Worldcraft-capable unit drop a cluster, build a useful perch, wall off a threat — needs human playthrough. Log watch entries.

## Pre-implementation plan

Audit-first. **The audit's primary job is to set the session split** (S1 and S6 are the deciders). **Plan-review checkpoint after audit is where the split is agreed with Chris** before any tier is built.

### Required first step: current-tree audit

Per "Paths to survey." Deliverables:
1. **Enumeration substrate (S1)** — tile-targeted offensive enumeration: exists or net-new. *Sizes Tier A and the shared spine.*
2. **Friendly-fire + elevation in scoring (S2, S3, S4)** — confirm reuse vs. build; confirm the fall rule.
3. **Barrier denial primitives (S5)** — pathing/LoS-delta available or net-new. *Sizes Tier B Barrier.*
4. **Threat model (S6)** — confirm absent; if so, Tier C + threat model is a separate session. *Sets the seam.*
5. **`validateAction` flag (S7).**
6. **Item-scoring diagnostic (S8)** — root-cause why Alchemy actions outscore lethal attacks. **Fork:** if it's a contained scaling/normalization bug, fix it in this session as a prelude (a commensurable scorer is a precondition for trustworthy Worldcraft scoring). If it's a structural issue — parallel non-normalized heuristics, a pre-emptive item branch — it spins out to its own brief and likely **precedes** the Worldcraft build, since building new action classes onto a non-commensurable scorer inherits the bug.
7. **Recommended session split**, presented at plan-review for Chris to ratify.

### Architectural decisions (provisional — audit-gated)

- **Shared spine:** extend action enumeration to tile-targeted offensive casts (or reuse Math Skill's path). All tiers route through it. ADR if net-new.
- **Tier A fall scoring:** per-footprint-tile `effectiveDrop` → signed damage → killValue, summed; reuse AoE friendly-fire (S2). No new damage paradigm — Pit/Valley are AoE damage abilities whose magnitude is an elevation function.
- **Tier B perch:** reuse `strongestDamageFollowUp` / the positional term to value the *post-raise* tile for a reachable height-seeking ally; gate the cast on the temperament dial (raising is a spent turn). No parallel scorer.
- **Tier B Barrier:** denial value = reduction in enemy reach to a protected ally (pathing-delta) + LoS lines blocked. Start at the simplest heuristic S5 supports (e.g., Barrier between an enemy melee threat and a low-HP ally) rather than full path recomputation, if the primitives are expensive.
- **Tier C:** FIFO queue lookahead + threat model; defer if S6 confirms no model. Build the threat model as a reusable component (defensive term + deployment also consume it).

### Decision points

- **D1 — Tier A scope: immediate fall damage only, no combo/setup reasoning?** Recommend yes — keep Tier A in the damage paradigm; "Pit to set up a future fall" is Tier C thinking. *Confirm.*
- **D2 — Tier B perch horizon.** Recommend: value a perch only if a height-seeking ally can reach+use it within the S56 single-move horizon (§4.4). Same boundary, applied to created terrain. *Confirm.*
- **D3 — Tier B perch, team-relative steal risk.** Should the AI penalize building a perch the enemy can exploit as readily as the ally? Recommend: ignore in v1 (value ally-exploitable perches only); add the enemy-steal penalty later if playtest shows the AI gifting perches. *Chris's call.*
- **D4 — Tier B Barrier sophistication for v1.** Heuristic (block-the-lane-to-a-squishy / block-a-LoS-line) vs. full pathing-delta. Recommend heuristic first, gated on S5. *Chris's call.*
- **D5 — Tier C: build after A+B if it fits (Chris's call).** Cover Tiers A and B in this session; the implementer then assesses whether Tier C fits — which in practice means whether the threat model it requires (S6) proves cheap enough to build alongside. If not, C is the next session. No upfront commitment either way; the assessment happens once A+B are in hand and the threat-model substrate is understood. *Settled — this DP records the approach, not an open question.*
- **D6 — Session split.** Deferred to the audit explicitly. Probable: A+B, then C+threat-model.

## Implementation work

By tier; ordering and which-this-session set at plan-review.

### Tier A — Pit / Valley fall damage

- Confirm/extend tile-targeted offensive enumeration (S1).
- Per-candidate-tile: compute `effectiveDrop = min(magnitude, currentElevation)`, damage = `effectiveDrop > 1 ? effectiveDrop × 10 : 0`.
- Pit: single tile. Valley: 3×3 ring (center −3 / cardinal −2 / corner −1), summed over occupants, signed friend/foe.
- Reuse AoE friendly-fire penalty (S2).
- `validateAction` off-map `tile_set` bounds check (S7).
- Tests: Pit on elev 0 → not chosen / scores 0; Pit on high ground with enemy → chosen; Valley over an enemy cluster → chosen; Valley that catches an ally → penalized/avoided; Valley corner deals 0; elevation-clamp cases (elev 2 Pit → 20). ~12-18 tests.

### Tier B — Pillar / Hill perch + Barrier

- **Perch:** enumerate Pillar/Hill target tiles; for each, value the raised tile as a future position for a reachable height-seeking ally (reuse positional machinery); gate on temperament dial.
- **Barrier:** enumerate Barrier lines; score denial per D4/S5.
- Tests: perch built when an ally can reach+exploit it; not built when no ally benefits or when acting-now is better (dial); Barrier scored when it protects a squishy / blocks a line; not when it walls nothing. ~15-25 tests, scenario-heavy.

### Tier C — revert traps (likely separate session)

- Threat/turn-prediction model (reusable component).
- FIFO queue lookahead: which raise reverts on the next over-cap cast; who rides it then.
- Value a revert-fall onto an enemy; refuse to drop an ally.
- Tests: TBD with the threat model. ~15-25 tests.

### Tests (total)

Per-tier above. Full arc ~40-65 tests across sessions; single-session subset depends on the split.

## Acceptance criteria

**Tier A:** Pit/Valley enumerated and scored elevation-aware; flat-ground drop declined; Valley friendly-fire penalized; off-map `tile_set` no longer throws. Unit-tested; human playtest logged.

**Tier B:** perch built when exploitable within horizon and worth the tempo; Barrier scored for real denial. Unit-tested; human playtest logged.

**Tier C (if this session):** revert-trap reasoning over the FIFO queue with the threat model; no ally self-drops. Unit-tested.

**Quality:** tests green; ADR(s) per plan-review; docs updated; Vercel clean; human-playtest watch entries logged.

## Out of scope

- **Defensive above-melee-reach term** — shares the threat model with Tier C; bundle there or after, not in A/B.
- **Multi-turn perch approach planning** — deliberate boundary (blueprint §4.4).
- **Cross-class Worldcraft balance** — this is AI scoring, not content/balance.
- **Default team templates with Terraformer; Calculator template revision; Marshmoor compliance tests** — standing carries.
- **Roster-wide Move tier; Math Skill SP scaling review** — watch-fors, not this arc.
- Cosmetic carries (lightning-mage.ts header, audit-draft archival).

## Files likely touched

Non-exhaustive; audit confirms.

- AI scorer / enumeration (`src/ai/` — audit confirms files) — tile-targeted offensive enumeration; per-tier scoring.
- `src/engine/effects/queue.ts` — read for Tier C (FIFO lookahead).
- `src/engine/.../validateAction` — off-map `tile_set` bounds check (S7).
- Pathfinding / LoS modules — Tier B Barrier (paths TBD).
- New threat-model module — Tier C (path TBD).
- `src/test/session-57-worldcraft-ai-*.test.ts` (split per tier).
- `docs/handoff.md`, `docs/playtest-watch.md`, ADR(s) in `docs/decisions/`.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first; the audit sets the session split** — this is the weightiest plan-review checkpoint of the arc. Do not build before the split is ratified.
- **Tier order:** A (spine + simplest payload) → B → C. C only after a threat model exists.
- **Browser verification is human-only** (harness can't drive AI battles); log watch entries rather than claiming verification.
- **Vercel pre-flight discipline.**
- **Mid-session design questions** route through Chris. Likely surfaces: Barrier denial sophistication (D4); perch steal-risk (D3); the threat-model build/defer call (D5); whether the enumeration warrants its own ADR.

## Watch-fors

**Addressed this arc:** Worldcraft AI scoring (the bulk of Piece 6).

**Carry-forward / dependencies:**
- Threat model (gates Tier C + the defensive term + role-aware deployment) — build once, reuse.
- Standing carries unchanged.

**Specific to this arc:**
- **Enumeration cost.** Tile-targeted enumeration multiplies candidates (every in-range tile × every Worldcraft work × footprint occupancy), on top of the S56 per-destination projection. Watch evaluation time hard; pruning (skip low-elevation tiles for drops, skip tiles with no nearby units) is likely necessary.
- **The AI gifting terrain.** A perch or a low Pit the enemy exploits better than the AI — the team-relative failure mode (D3). Watch playtest for the AI building terrain that helps the opponent.
- **Tempo bleed.** Pillar/Hill perch-building is a spent turn; over-eager building is the same passivity failure mode as over-climbing. The temperament dial guards it; watch it.
- **Friendly Valley.** A Valley dropping the AI's own clustered line — confirm the friendly-fire penalty actually deters it in play, not just in tests.
- **Off-map `tile_set` (S7)** — confirm the bounds check makes `validateAction` total once the AI starts generating tile sets near edges.
- **Three-resolver drift** — perch/fall scoring must route through the shared projection resolver, not a parallel Worldcraft scorer.
- **Scorer commensurability (S8).** The Alchemy finding is a warning that action classes may not share one scoring currency. Whatever the fix, confirm Worldcraft casts are scored on the *same* scale as attacks and items — a Pit should lose to a lethal swing, and win only when it does more expected good. If the audit defers the item fix, treat any Worldcraft-vs-attack mis-ranking in playtest as the same underlying issue, not a Worldcraft-specific one.

## Estimated size

**Large; the audit sets the split.** Most probable shape: **Session 57 = Tier A + Tier B** (shared enumeration spine, perch on existing substrate, Barrier at heuristic sophistication), **Session 58 = Tier C + the threat model** (and likely the deferred defensive term, since it shares the model). If S1 finds tile-targeted enumeration net-new and expensive, Tier A alone may fill a session and B slips. Plan-review ratifies.

**Split contingency:**
- Spine + Tier A = the must-ship floor (makes the destructive works competent).
- Tier B Barrier drops before Tier B perch if pathing/LoS primitives (S5) are costly.
- Tier C never ships without its threat model.
