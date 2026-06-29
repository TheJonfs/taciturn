# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S77 — TABA campaign M0, the spine slice (2026-06-29)

Shipped M0 end to end — the first TABA campaign milestone. New `src/campaign/`
shell region + a Formation screen + a `BattleView.onBattleEnd` hook, all reusing
the **unchanged** engine (no engine changes, as the audit predicted). ADR-0133.
Five commits on `main` (design docs; Chunk 1 spine; Chunk 2 pure loop core;
Chunk 3a node graph/loop/persistence; Chunk 3b React flow). `tsc -b` + `vite
build` clean; suite green (2173, +58 campaign tests). Guide-changelog updated
(S77); decomposition §8 marks M0 shipped.

### The ONE thing left — live-verify the full two-battle playthrough
I live-verified everything up to battle launch (title → New Campaign → autosave +
vitals bootstrap → Formation N=8/K=5 → Deploy → fold → DeploymentScreen with
recomputed-stat units; no console errors). **What I could NOT drive via tooling**
is the interactive Pixi battle itself, so please hand-verify:
- Play node A (River Ridge) to a **win** → confirm it heals/advances → Formation
  for node B (Stonebridge) → win → **campaign-complete** screen.
- Force a **loss** (forfeit/let the company die) → confirm the **Defeat** screen,
  **Retry** re-enters the node from the autosave (full roster back), **Quit**
  returns to title.
- Reload mid-campaign (after winning node A) → **Resume Campaign** continues at
  node B with the post-node-A roster.
- Confirm a unit that **crystallizes (permadeath)** in a won battle comes back
  marked **lost** and is absent from the next Formation list.
The pure loop (win/advance/save, fate classification, retry) is unit-tested
hard; this is the UI-integration confirmation only.

### Encounter winnability (needs a play read, not a code fix)
M0 reuses the shipped battle templates' enemy teams (River Ridge / Stonebridge
`team_b`) at their authored stats vs the campaign roster at **level 25** (a tuning
value in `roster.ts` / `M0_BASELINE_LEVEL`). The spine doesn't care about balance,
but the **loop test needs both outcomes reachable** — i.e. the fights should be
*winnable by competent play* and *losable*. If a node is unwinnable or trivial,
bump `M0_BASELINE_LEVEL` or hand-author small enemy teams (the brief's fallback).

### Known M0 simplifications (by design — not bugs)
- **Wounds don't carry yet** — heal-to-full each boundary (D-E). The carry
  plumbing is built + exercised (the fold supplies explicit clamped vitals);
  switching it on is a one-line change in `apply-back.ts` (write final vitals
  instead of effective-full). Deferred to an attrition pass.
- **Initial-roster vitals bootstrap:** the authored roster carries *provisional*
  base-max vitals; `startCampaign` normalizes them to effective-full via the
  fold's probe (`bootstrapRosterVitals`). Verified live (casters show
  equipment-boosted MP). See ADR-0133 §6.
- Formation / victory / defeat screens are **minimal styling** — polish later.

### Next TABA milestones (decomposition §8)
M1 = branching battle-graph (M0 is linear A→B). M2 = progression (XP/JP/level/
unlock) — the "growth before gear" call. M3 = economy + acquisition. The
delta-summary superset already emits per-unit survival/vitals; M2 extends
`UnitBattleSummary` with XP/JP once the battle *tracks* them (don't pre-build the
empty fields).

### Carried from S76 — RESOLVED, do not re-carry
Bear's Heave throw UI was **live-verified by Chris** (resolved). The remaining
S76 content-tuning watch-fors (Fist/Chakra/Serpent's Coil coefficients, etc.)
were **migrated to `docs/playtest-watch.md`** (commit `38fe826`) so they survive
into content sessions. Nothing from S76 carries forward here.
