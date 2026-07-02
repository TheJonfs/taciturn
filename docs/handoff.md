# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S80 — TABA M2: per-class level→stat curves (2026-07-02)

**Shipped** the base-stat-curve piece of M2 (ADR-0137, brief
`docs/TABADesign/m2-stat-curves-brief.md`). `buildBaseStats(class, brave, faith,
level)` now composes a real per-class curve for the five level-driven stats,
replacing the S49/S50 ±10% slot modifier. Suite green (**2271**, +60 curve
tests), `tsc -b` + `vite build` clean.

New/changed code:
- `src/content/classes/stat-curves.ts` (**new**) — curve constants + pure
  `leveledClassStats(classId, level)` (linear PA/HP/MP · quadratic uncapped MA ·
  piecewise floored Speed with L50 plateau + 99 cap). Also exports `paCurve` /
  `maCurve` / `spdCurve` etc. (pre-round floats) for tests/tooling.
- `src/content/teams/built-team.ts` — `buildBaseStats` is now a thin composition
  over `leveledClassStats` + Brave/Faith + crit defaults; dropped the ±10% /
  dominant-stat modifier and the `classBaselineStats`/`classDominantStats`
  imports. **The per-unit stat-override seam is documented in its docblock**
  (future unique-character override = a `modifyStatQuery` handler at the `class`
  tier, keyed by unit id — NOT wired).
- Tests: `stat-curves.test.ts` (new, 61 assertions — full L1/L25/L50 tables +
  L25=§5 + past-L50 MA-runaway/Speed-plateau); `level-substrate.test.ts`
  rewritten (its old ±10% assertions gone; now covers slotLevelFor +
  buildBaseStats-delegates-to-curve + the dominantStat parity check).

### Two decisions confirmed with Chris (in ADR-0137)
- **MW re-tunes its off-L25 mages.** The brief's "byte-identical MW" premise was
  wrong — MW deploys the Knight at L25 but the mages at L24/26/23/27, whose
  *current* numbers came from the modifier we removed. Chris chose **keep 23–27,
  adopt the curve** (blessed re-tune; Knight unchanged). Old→new numbers are in
  ADR-0137 §Decision 4 and the guide-changelog. Player-facing → logged.
- **Stat seam = pragmatic.** `buildBaseStats` stays the class *seed*; the future
  per-unit override arrives as another `modifyStatQuery` handler (class tier),
  not by re-baking. Did **not** activate the dormant `class` hook tier as a live
  handler (out of scope / risky).

### Finding worth carrying: the "99 cap" is a guide fiction
No 99 clamp on pa/ma/hp/mp exists in code, and `RulesetSpeedBounds.ceiling` is
`null`. We honored the spec minimally (Speed `min(99,…)` at the curve output; MA
uncapped) rather than build a clamp subsystem. If the mechanics guide still
claims a global 99 cap, it's inaccurate — worth a guide-doc correction someday
(not done this session).

### Next M2 pieces (not started)
- **XP → level** mechanics (feeds the `level` this consumes; extend
  `UnitBattleSummary` to *track* XP/JP once the battle emits it — don't pre-build
  empty fields, per the standing S78 note).
- **JP → ability unlock** ("everything unlocked" → earned).

### Carried from S79 (still open, still by-design/low-priority)
- **Multi-battle-node persistence (the deferred "v3")** — only needed when
  consecutive battle beats in one node are authored; M1.5 authors none. Save
  schema stays v2.
- **Portrait override seam (ADR-0136)** — M5 completion to-do (durable
  `CampaignUnit.portrait?` + engine threading + speaker→roster-unit link) lives
  in ADR-0136; untouched.
- **Border-shorthand console warnings** (M1 Formation/Deployment rows) — cosmetic,
  dev-only, still not cleaned up.
- Terminal-victory result-summary at "The Return" still worth an eyeball on a
  future playthrough.
