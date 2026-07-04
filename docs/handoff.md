# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S81 — TABA M2: JP progression substrate (2026-07-04)

**Shipped** the JP-economy **substrate** (ADR-0138, brief
`docs/TABADesign/m2-progression-jp-implementation-brief.md`). This was the
first half of a deliberate substrate→content split (Chris's call: decide on
carrying the content half by context spend — we stopped at substrate). Suite
green (**2319**, +52 new), `tsc -b` + `vite build` clean. A three-agent
substrate audit preceded the build; findings drove the design (see ADR-0138).

New: `src/campaign/progression/` (tokens, tier-map, thresholds,
component-catalog, ledger, unlock, usable-actives, earning, index + tests).
Touched: `campaign/types.ts` (`JpLedger` + 3 `CampaignUnit` fields),
`serialization.ts` (**v2→v3**), `roster/battle-result/apply-back`; engine
`unit.ts`/`battle-config.ts` (`usableActives?`), `create-initial-state.ts`
(thread), `actions/validate.ts` (gate), `ui/use-turn-flow.ts` (grey).

### What is DONE (mechanism, tested against fixtures)
- **Durable state:** `jpLedger {earned,spent}`, `unlocks: UnlockToken[]` (one
  tagged union over ability|item|mathParameter|mathValue), `classAccessOverride?`.
- **Derived selectors:** `availableJp`, `spentByTierSlot`, `unlockedTiers`,
  `reclassableClasses` (accumulators are DERIVED, never stored — rule 5).
- **Ops:** `unlockComponent` (spend), `grantJp`/`grantOnClassUnlock`/
  `tierGrantAmount` (deterministic-with-seed), `canEquipPassive` (R/S/M export
  gating — native-free / export-tax / native-only).
- **Gating mechanism:** `Unit.usableActives?` opaque allowlist (`undefined ⇒ all
  usable`), enforced in `validateUseAbility`, greyed in the menu. `usableActiveIds`
  projects the durable unlocks → the battle mask.
- **Earning seam:** `computeEarnedJp(actionLog)` (post-hoc log read, NO new hook)
  + `UnitBattleSummary.earnedJp` + apply-back banking (survived/downed, not lost).

### DECISIONS NEEDING CHRIS (tunables / injections — none block the substrate)
- **Per-action earning rate + final "connecting" predicate** — Chris said he'd
  bring the exact mechanism *this session* (successful connects, not misses/
  reactions). Built as an **injectable** seam defaulting to the budget anchor
  (`DEFAULT_JP_PER_CONNECTING_ACTION = 14`, `defaultConnectingPredicate`). When
  he brings it: thread `EarnOptions` through `summarizeBattleResult` callers.
- **`GRANT_RANDOM_RANGE`** — brief says "N×100 + random" with no bound; I chose
  `[0,100)`. Confirm.
- **Spillover** on over-threshold / leftover-from-prior-class JP — brief seam,
  unbuilt. Still TBD.

### The CONTENT HALF (the other half of this brief — not started)
1. **~110 real ability costs** from `m2-jp-costing-budget.md` into
   `COMPONENT_CATALOG` (ships empty; selectors are table-driven → zero code
   change to light up).
2. **Combinator enumeration wiring** — the audit OVERTURNED the brief here:
   Alchemist items + Calculator params/values are NOT an engine rework, they're
   the SAME mask at their UI enumeration sites (`action-menu.tsx:794` items,
   `:537-548` params/values, + a trivial id→label registry extraction). Add
   `item`/`mathParameter`/`mathValue` tokens to the unlocked-set filter there;
   combinators stay 0-JP always-on shells. Optional defensive re-checks in
   `validateUseCompound`/`validateUseThrowItem`/math-skill validation.
3. **Flip the fold to stamp `usableActives`** — the campaign fold currently
   does NOT stamp the mask (M0/M1 fold ungated → existing play unchanged). Turn
   it on (project via `usableActiveIds` in `snapshot-fold.ts`) once authored
   unlock states + a reclass/spend UI exist. This is the "make gating live" step.

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
