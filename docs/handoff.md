# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 59 close (2026-06-10) — threat coverage map + defensive term + Tier C

S59 built the **incoming-threat / danger model** (blueprint §3 Layer 1) and
two of its consumers. **1680 → 1709 tests** (+29), `tsc -b` clean, `vite
build` clean. Three commits to main:

1. `1a1d2e8` — coverage map foundation (ADR-0094)
2. `7dad157` — defensive above-melee-reach term (ADR-0095)
3. `1033062` — Tier C revert-traps (ADR-0096)

### What shipped

- **Coverage map (ADR-0094)** — `src/ai/threat/coverage-map.ts`.
  `buildCoverageMap` (full/bounded) + `threatsToTile` (single-tile, for the
  deferred Barrier consumer). "Which enemies can reach-and-hit tile X this
  turn, melee/ranged tagged, expected damage." Reach mirrors `validate.ts`
  (distance + bow height-range + `rangeMode` LoS/arc), so hypothetical
  elevation-/barrier-mutated states recompute through the same pure path.
  melee/ranged tagged by **effective horizontal reach** (a Longbow leaves
  `attack` at `rangeMode: 'melee'` but reaches 5 → correctly ranged). Damage
  projected **once per (enemy, attack)** at current positions (perf).
- **Defensive term (ADR-0095)** — a **tie-break**, not a score penalty.
  Offence decides whether/what to attack; residual danger only chooses which
  equal-offence tile to fire from. (A score-subtraction form made the AI
  cower — symmetric battles never decided — so it was reformulated.)
  Neutralised-threat discount: a plan's danger excludes an enemy it would KO.
- **Tier C revert-traps (ADR-0096)** — at cap, casting a harmless raise
  evicts an older Pillar/Hill, dropping an enemy riding it (Tier A fall rule).
  Hard ally-veto. Opportunistic only (no speculative laying, no prediction).
  Exposed `computeWorldcraftEffectCap` via new `src/engine/effects/index.ts`.

### Decisions ratified at plan-review (Chris)

- **D1:** all three consumers + Barrier full was the original target; revised
  mid-session (below).
- **Defensive term:** discount neutralised threats; isolate offence from
  safety in the affected offensive-logic tests (both Chris's calls). Shipped
  as a tie-break after the score-subtraction form caused stalls.
- **Barrier denial → DEFERRED** (Chris's call) to pair with the
  **arc→straight_line audit** (below). Its LoS-delta lever is inert in current
  content (every ranged attack is `arc`, which lobs over walls; only `taunt`
  is straight_line and deals no damage), so building it now would be
  pathing-delta-only + reworked later. The coverage map's `withBarrier`
  hypothetical + `threatsToTile` are already built and honor both deltas — so
  the deferred session is just the content pivot + the denial scorer.

### Next session — arc→straight_line audit + Barrier denial (bundled)

See memory `project_arc-to-straight-line-audit`. Two paired pieces:
1. **arc→straight_line content audit.** `grep rangeMode
   src/content/abilities/` — every ranged damage attack is currently `arc`.
   Go over them *with Chris* and pivot chosen ones to `straight_line` so
   Barrier LoS-denial becomes meaningful (shared design decision, not
   autonomous). The coverage map already honors the straight_line LoS gate.
2. **Barrier denial scoring** (Tier B's deferred half). For a vulnerable
   ally, score the coverage-delta of a candidate 3–5-tile barrier line
   (`threatsToTile` live vs. `withBarrier`). **Bound candidate placements**
   (lines × orientations × positions) — perf is the headline risk. Barrier is
   a `tile_set` cast.

### Browser verification — NOT done (and why)

Same PixiJS constraint as S55–S57: the harness can't drive AI battles
(federated events reject synthetic pointer events). All S59 AI behaviour needs
a **human playthrough**. Watch entries logged in `docs/playtest-watch.md`:
defensive term (tie-break strength vs. tempo; neutralised-threat discount
scope; coverage-map latency) and Tier C (revert-trap opportunism/frequency;
never-drop-ally veto). Key things to watch: does the AI take safe high ground
against melee but not ranged without dithering? Does it spring revert-traps
sensibly and never drop its own units? Is per-turn AI think-time acceptable on
a full Terraformer battle?

### Loose end to clear

- **Untracked `src/assets/portraits/templar-male.png`** appeared in the
  working tree during S59 (not present at session start, not created by S59
  work). I accidentally swept it into the Tier C commit and amended it back
  out — it's untracked again. Decide whether it belongs in a commit (it looks
  like a real portrait asset) or should be removed. Left exactly as found.

### Standing carries (unchanged, not addressed this session)

- **AI role-aware deployment sorting** — the coverage map's eventual 4th
  consumer, now unblocked (the map exists). A clean next-after-Barrier item.
- Layer-2 positional prediction (only if ever wanted).
- Worldcraft move-then-cast planning (enumeration-cost boundary).
- Full killValue-weighted Math re-base.
- Perch "move onto a created perch" (hypothetical-reach + jump-climb).
- Default team templates with Terraformer; roster-wide Move-tier discussion;
  Calculator team-template revision; Marshmoor template-compliance tests;
  lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; terrain-transition animation; Calculator AI personality variants;
  Math Skill SP scaling review.

### Untouched by request

- **Uncommitted `guide/` working-tree changes** — none present this session;
  every S59 commit is scoped to game code + docs only.
