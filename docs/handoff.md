# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S81 — TABA M2: JP progression substrate + per-class pools + costs (2026-07-04)

**Shipped** the JP-economy substrate AND most of its content half (ADR-0138,
briefs `m2-progression-jp-implementation-brief.md` + `m2-jp-costing-budget.md`),
across **two commits** (substrate, then per-class + earning + costs). A three-
agent substrate audit + a cost-mapping agent preceded the build. Suite green
(**2330**), `tsc -b` + `vite build` clean.

`src/campaign/progression/`: tokens, tier-map, thresholds, component-catalog
(+data — the real 114-entry cost table + guard test), ledger, unlock,
usable-actives, earning, index. Touched: `campaign/types.ts` (`earnedByClass` +
`unlocks` + `classAccessOverride?`), `serialization.ts` (**v4**),
`roster/battle-result/apply-back`; engine `unit.ts`/`battle-config.ts`
(`usableActives?`), `create-initial-state.ts` (thread), `actions/validate.ts`
(gate), `ui/use-turn-flow.ts` (grey).

### DONE (mechanism + data, tested)
- **Per-class JP** (Chris's call — revises ADR-0138's single pool): `earnedByClass:
  Record<classId, number>` STORED; `spent` fully DERIVED (`spentInClass`). Buying
  checks affordability in the component's native class; grants land in the
  unlocked class's pool. Save **v4**.
- **Earning mechanism** (Chris's rule): actor earns `floor(10 + level/4)` into
  its current class; every other roster unit (in-battle + BENCHED) earns `1/8`
  of that into its class; floored; only player-roster actions; `lost` banks
  nothing. Runs in **apply-back** (needs the roster for bench spillover), not
  the summarizer. `base` + `connecting` injectable — **XP reuses the trigger
  with a different `base`**. Grant random bound = **50**.
- **The ~110 real costs** — `component-catalog-data.ts` (114 entries), guarded
  by `component-catalog-data.test.ts` (ids resolve, native classes valid,
  per-class sums = budget-doc totals).
- **Gating mechanism:** `Unit.usableActives?` opaque allowlist, enforced in
  `validateUseAbility`, greyed via `computeAbilityDisableReason`. `usableActiveIds`
  projects unlocks → mask.

### REMAINING M2 content-half wiring (NOT done — next up)
1. **Combinator enumeration filters** — the tokens are now PRICED, but the
   pickers don't filter by unlock. Add `item`/`mathParameter`/`mathValue`
   filtering at `action-menu.tsx:794` (Alchemist items) + `:537-548` (Calculator
   params/values, + a trivial id→label registry extraction). Combinators stay
   0-JP always-on shells. Optional defensive re-checks in `validateUseCompound`/
   `validateUseThrowItem`/math-skill validation. (Audit confirmed: NOT an engine
   rework — same mask mechanism, UI-enumeration only.)
2. **Flip the fold to stamp `usableActives`** — currently unstamped (M0/M1
   ungated → play unchanged). Project via `usableActiveIds` in `snapshot-fold.ts`
   once authored unlock states + a reclass/spend UI exist. The "make gating live"
   step.
3. **Reclass / spend UI** (M2 UI) — `reclassableClasses` + `unlockComponent` +
   `grantOnClassUnlock` are the model; no UI consumes them yet.
4. **Spillover on over-threshold spend** — brief seam, still TBD.

### XP brief now present
Chris added `docs/TABADesign/m2-progression-xp-jobtree-brief.md` (the XP→level
companion the JP brief referenced). **Not read this session** — it's the other
M2 currency (independent of JP) and links to the S80 stat-curves. Read it before
the XP work.

### Carried from earlier (still open, still by-design/low-priority)
- **Multi-battle-node persistence ("v3" of that lineage)** — only needed when a
  node authors consecutive battle beats; none authored yet. (Note: campaign save
  schema is now literally v3 for an unrelated reason — the JP fields.)
- **Portrait override seam (ADR-0136)** — M5 completion to-do, untouched.
- **Border-shorthand console warnings** (M1 Formation/Deployment) — cosmetic,
  dev-only, uncleaned.
- **"99 cap" is a guide fiction** (S80 finding) — no global 99 clamp in code;
  worth a guide-doc correction someday.
