# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 57 close (2026-06-08) — scorer unification + Worldcraft Tier A & B-perch

S57 pivoted (per the audit's S8 finding) to fix the scorer foundation, then —
context budget permitting — went on to build Worldcraft Tier A and Tier B
perch on the now-commensurable scorer. **1664 → 1680 tests** (+16), `tsc -b`
clean, `vite build` clean. Three commits to main:

1. `def2c76` — unify AI scoring currency (ADR-0092)
2. `1761301` — Tier A: Pit/Valley fall-damage scoring + S7 fix
3. `7d3202e` — Tier B (perch): Pillar/Hill lift-in-place

### What shipped

- **Unification (ADR-0092):** `decideBasicAi` builds one scored candidate
  pool; the three pre-empt phases (Alchemist / Math / heal) are gone;
  Compound demoted to last resort. Fixes the "Alchemy-Knight never attacks"
  bug. Dials: `HEAL_WEIGHT 0.7`, `REVIVE_WEIGHT 1.5`,
  `CLEANSE_VALUE_PER_DEBUFF 15`, `ETHER_VALUE_FACTOR 0.1`,
  `MATH_SCORE_SCALE 1.0`.
- **Tier A (ADR-0093):** `bestWorldcraftFallCandidate` scores Pit/Valley as
  fall-damage casts, reusing the engine's exported `buildElevationChanges` +
  `FALLING_DAMAGE_PER_LEVEL`/`>1` gate (zero drift). Current-position
  candidates only (no move-then-cast — bounds enumeration cost). + the S7
  `validateAction` off-map bounds check (tile/tile_set).
- **Tier B perch (ADR-0093):** `bestPerchCandidate` values raising the tile a
  height-seeking ally already stands on ("lift-in-place"), via a new
  `withElevationChanges` hypothetical-state helper + range-relaxed
  `strongestDamageFollowUp`, discounted by `PERCH_DAMP 0.5`.

### Decisions ratified at plan-review (Chris)

- **S8 pivot:** unify first (S57), Worldcraft A+B this session, **Tier C +
  threat model → S59**.
- **Math:** normalize & compete (full killValue re-base deferred).
- **Revive:** scored candidate (competes, can lose to a finish).
- **D1/D2:** Tier A immediate-fall-only; perch single-move horizon — narrowed
  to **lift-in-place** for v1.
- **D3:** ignore perch steal-risk.
- **D4:** updated mid-build from "heuristic first" to **defer Barrier to
  S59** — grounding showed Barrier denial scoring *is* threat-model logic
  ("which enemies can reach/hit ally A"), so a heuristic now would be
  throwaway work S59 replaces.

### Audit results still relevant for S59

- **Threat model is ABSENT (A4).** Building blocks exist (`projectUpcoming`,
  per-unit `getLegalMoves`, the `withElevationChanges` hypothetical-state
  pattern shipped this session generalizes to barrier-inserted states), but
  no "which enemies can reach/hit tile X next turn" aggregation. This gates
  **Tier C, Barrier denial, the deferred defensive above-melee-reach term,
  and role-aware deployment** — build it once, reuse across all four.
- **Worldcraft enumeration cost** is the headline perf risk (flagged in
  playtest-watch). Current-position-only casting bounds it for now.

### Next session (S59) — threat model + its consumers

- Build the reusable incoming-threat / danger model.
- **Barrier denial** scoring (Tier B's remaining half) on top of it.
- **Tier C** revert-traps: FIFO queue lookahead (`queue.shift()` is the
  oldest-evicts confirmed FIFO, `src/engine/effects/queue.ts`) + threat model
  — value a raise whose revert drops an enemy rider, never an ally.
- Likely also the **defensive above-melee-reach term** (shares the model).
- Smaller deferred items: perch "move onto a created perch" (hypothetical-
  reach + jump-climb), Worldcraft move-then-cast planning, the full
  killValue-weighted Math re-base.

### Browser verification — NOT done (and why)

Same constraint as S55/S56: PixiJS federated events reject synthetic DOM
pointer events, so AI battles can't be canvas-driven through the preview
harness. All S57 AI behavior (does the AI finish kills / heal / revive /
craft / drop clusters / lift archers at sensible moments) needs a **human
playthrough**. Watch entries logged in `docs/playtest-watch.md` (unification
dials; Compound under-crafting; Math raw scoring; Pit/Valley target feel;
PERCH_DAMP tempo; enumeration cost).

### Standing carries (unchanged, not addressed this session)

- Default team templates with Terraformer; roster-wide Move tier discussion;
  Calculator team-template revision; Marshmoor template-compliance tests;
  lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; AI deployment role-aware sorting (now explicitly shares the S59
  threat model); terrain-transition animation (S55 deferred stretch);
  Calculator AI personality variants; Math Skill SP scaling review.

### Untouched by request

- **Uncommitted `guide/` working-tree changes** — left exactly as found, per
  the standing S55 call. Every S57 commit is scoped to game code + docs only.
