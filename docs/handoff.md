# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 57 close (2026-06-08) — AI scoring commensurability (the S8 pivot)

S57 was the brief's Worldcraft AI session, but its audit (S8 diagnostic)
found a **structural** scorer problem and the session **pivoted** to fix it
first, per the brief's own S8 fork and Chris's plan-review call. **1664 →
1669 tests** (+5), `tsc -b` clean, `vite build` clean. Committed to main.

### What the audit found (full results, for the deferred Worldcraft work)

The audit surveyed all of S1–S8. Key results to carry into S58/S59:

- **S1 — enumeration spine largely EXISTS.** The AI already enumerates
  tile-anchored **AoE-damage** casts via `scoreAoeOffensive` (tile
  enumeration → footprint occupancy → signed per-occupant sum →
  friendly-fire). The five Worldcraft works don't reach it: Pillar/Pit/Hill/
  Valley are `targeting.kind: 'tile'` with an `effects.worldcraft` payload
  (no `damage`/`aoe`), so `isOffensive` rejects them; Barrier is `tile_set`,
  handled **nowhere** in `src/ai/`. So Tier A = a new payload-recognition +
  fall-damage score function on the **existing** enumeration spine — *not*
  the brief's worst-case from-scratch build.
- **S4 — fall rule confirmed exactly.** `FALLING_DAMAGE_PER_LEVEL = 10`
  ([fall-damage.ts:20]), gate strictly `> 1` (`if (dropDistance <= 1) return
  null`), floor-clamp implicit (elevation floors at 0 →
  `effectiveDrop = min(magnitude, startElev)`). Pit/Pillar ±4 single-tile;
  Hill/Valley 3×3 `[1,2,1;2,3,2;1,2,1]` kernel. Engine reducer applies the
  same gate, so the AI just mirrors it.
- **S5 — Barrier primitives callable, hypothetical query net-new.**
  `getLegalMoves(state, unitId, catalog)` (any unit) and
  `hasLineOfSight(map, from, to)` (arbitrary endpoints) exist. Missing:
  "recompute reach/LoS with a barrier inserted" — needs a shallow map-clone
  or parameterized pathfinding (~50–100 LOC). Tier B Barrier is buildable at
  heuristic sophistication.
- **S6 — threat model confirmed ABSENT.** `projectUpcoming` + per-unit
  `getLegalMoves` are building blocks, but no "which enemies can reach/hit
  tile X next turn" aggregation / danger-map exists. **Tier C stays gated on
  building this** (reusable: also unblocks the deferred defensive
  above-melee-reach term + role-aware deployment).
- **S7 — `validateAction` off-map throw confirmed live-latent.**
  [validate.ts:406] (`tile_set`) and [validate.ts:449] (`tile`) call `tileAt`
  with no bounds check → `OutOfBoundsError` off-map. One-line bounds check
  each. **NOT fixed this session** (no AI yet generates tile sets); fold into
  Tier A when the Worldcraft enumerator lands.

### What shipped (ADR-0092)

Replaced `decideBasicAi`'s three **pre-empt phases** (Alchemist 0a, Math 0b,
heal 0) with **one commensurable candidate pool**. Every action class is
scored in `expected-damage-equivalent value × target value`; the pool's max
(if `> 0`) is committed. Builders:
- Heal: `effectiveHeal × killValue(ally) × HEAL_WEIGHT(0.7)`; removed the
  `HEAL_THRESHOLD` cliff (missingHP cap zeroes full-HP allies naturally).
- Item throws: Potion → heal map; **Phoenix Down revive →
  `maxHpBase × REVIVE_WEIGHT(1.5)`**; Remedy → `debuffCount × 15`; Ether →
  `mp × 0.1`.
- Math: dropped `MATH_SCORE_THRESHOLD`; `pickBestMathSkill` returns its best
  positive option, injected at `MATH_SCORE_SCALE(1.0)` (raw HP-swing, not
  killValue-weighted — full re-base deferred).
- Joint offense+buff planner unchanged, refactored to **return its best
  plan's score** so it competes in the pool.
- **Compound demoted to last-resort** (after the distance-move fallback) —
  banking can no longer block a kill/advance. This fixes the reported
  Knight-with-Alchemy "finishes a fight without attacking" bug.

ADR-0092 supersedes the phase-ordering parts of S39b / S49 / S13+S20a
(scoring *inputs* reused; only commit-ordering replaced).

### Decisions Chris made at plan-review

- **Pivot to unification first** (over building Worldcraft commensurably-
  anyway, or a narrow guard). Worldcraft Tier A+B → **S58**; Tier C + threat
  model → **S59**.
- **Math: normalize & compete** (not a full projection/killValue re-base).
- **Revive: a scored candidate** that competes (can lose to a strong finish).

### Tests

+5 in `src/ai/session-57-commensurability.test.ts` (the Alchemist/Math AI
*decision* paths had **no** prior `decideBasicAi`-level coverage — the
refactor was behavior-preserving on all 1664 prior tests precisely because
the broken edge cases were untested). The new tests pin: Alchemy-secondary
finishes a kill instead of banking-Compound; a strong attacker with Math
secondary attacks instead of a marginal Math; heal wins for a dying ally;
revive fires when nothing better; revive *loses* to a clean finish. Two
tests required positioning the actor behind the (north-facing) target so the
in-place attack is the best angle — otherwise the joint planner correctly
*moves to set up a back attack* (lower target evasion), which is intended
two-action behavior.

### Browser verification — NOT done (and why)

Same constraint as S55/S56: PixiJS's federated events don't accept synthetic
DOM pointer events, so AI battles can't be canvas-driven through the preview
harness. AI behavior changes (does the AI now finish kills / heal / revive /
craft at sensible moments) need a **human playthrough**. Three watch entries
logged in `docs/playtest-watch.md` (value dials; Compound under-crafting;
Math raw scoring).

### Next in the arc

- **S58 — Worldcraft Tier A + B**, now onto a commensurable scorer. Tier A:
  Pillar/Pit/Hill/Valley fall-damage scoring (recognize `effects.worldcraft`,
  reuse the `scoreAoeOffensive` enumeration spine, mirror the S4 fall rule) +
  the S7 `validateAction` bounds-check. Tier B: perch (S56 positional
  substrate + temperament dial) + Barrier denial (S5 primitives, heuristic
  sophistication first).
- **S59 — Tier C + threat model** (+ likely the deferred defensive
  above-melee-reach term, which shares the model).

### Deferred from this session (S57)

- **Math killValue-weighted re-base** — Math injects raw HP-swing; competes
  but isn't fully weighted. Follow-on.
- **Move-to-heal / move-to-utility** — heals/items/Math scored from current
  position only (joint planner's move-awareness covers offense+buffs).
  Unchanged, still deferred.
- **Compound "craft when idle and safe"** — if playtest shows support
  Alchemists under-stocking (see watch entry), add a small positive idle
  Compound score.

### Standing carries (unchanged, not addressed this session)

- Default team templates with Terraformer; roster-wide Move tier discussion;
  Calculator team-template revision; Marshmoor template-compliance tests;
  lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; AI deployment role-aware sorting; terrain-transition animation
  (S55 deferred stretch); Calculator AI personality variants; Math Skill SP
  scaling review.

### Untouched by request

- **Uncommitted `guide/` working-tree changes** — left exactly as found, per
  the standing S55 call. Every S57 commit is scoped to game code + docs only.
