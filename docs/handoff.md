# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 61 close (2026-06-10) — Barrier denial (Worldcraft Tier B)

S61 shipped **Barrier denial** — the AI Terraformer screens its most-threatened
ally with a wall, scored as **net coverage-delta** (ally protection minus the
barrier's cost to the AI team's own offense). This was the deferred Tier B
coverage-map consumer (ADR-0094), unblocked by the S60 arc→straight_line cut.
**1716 → 1721 tests** (+5), `tsc -b` clean. One ADR: **0098**.

S60 and S61 were done in the **same working session** (context budget allowed it),
but as **separate sessions/commits**: S60 = the content cut + offence-LoS fix
(committed; ADR-0097), S61 = barrier denial (this entry; ADR-0098).

### What shipped (commit directly to main — Chris is sole worker)

- **`withBarrier(state, line)`** (`src/ai/basic.ts`) — the hypothetical-state
  helper the S59 brief wrongly assumed existed. Clones the map, sets a minimal
  `tile.barrier` on the line (presence is all the threat model reads). Mirrors
  `withElevationChanges`. Pure, scoring-only.
- **`bestBarrierDenialCandidate`** — net scorer (ADR-0098 §1): Gain = reduction
  in `threatsToTile` incoming to the protected ally (live vs. `withBarrier`) ×
  killValue; Cost = the AI team's lost offense to each enemy, measured by the
  *same* resolver with `occupant` flipped to each enemy (so enemies-of-occupant =
  the AI team). Net = Gain − Cost. Pushed into the unified pool at the Worldcraft
  site, no damp (protection is immediate, unlike perch).
- **Bounding (D5):** protect top-1 most-threatened ally; ≤12 cardinal-screen
  candidates × lengths {3,4,5}; lazy two-stage — cheap gain for all, expensive
  per-enemy cost only for the top-3 gainers. **Measured ~2 ms/decide on a 4v4** —
  far under the ~1s baseline.
- **Reactive only:** no threatened ally → no candidate (no speculative/zoning
  walls in v1).
- Tests: `src/ai/session-61-barrier-denial.test.ts` (+5) — screens a threatened
  ally on the sightline; declines no-threat; declines net-negative self-walling;
  declines an ineffective adjacent-melee wall; declines an arc threat (the
  LoS-delta dependency on the S60 cut).

### Decisions ratified at plan-review (Chris)

- **Bounding:** as proposed (top-1 ally, ≤12 cardinal screens, lazy gain-then-cost
  on top-3).
- **Self-obstruction cost:** symmetric `threatsToTile` over enemies (the AI team's
  lost offense) — net benefit, not ally-protection only.
- **Idle case:** decline — no speculative walls.

### Next session — role-aware deployment sorting (the last coverage-map consumer)

ADR-0094 named four threat-model consumers. Three Tier-B/C shipped (defensive
term S59, perch S57, revert-traps S59) plus Barrier denial (S61). **Role-aware
deployment sorting is the fourth and final one — now the clean next item.** It
uses the coverage map at the pre-battle deployment phase to place units by role
(squishies behind cover / out of threat, front-liners forward). The map and the
`threatsToTile` / `buildCoverageMap` substrate are all in place.

### Browser/playtest verification — NOT done (and why)

Same PixiJS constraint (the harness can't drive AI battles). Barrier denial needs
a **human playthrough**. Watch entries logged in `docs/playtest-watch.md`
("Session 61"): does the AI wall sensibly without self-walling; does it correctly
*not* wall against arc/bow attackers; and **per-turn think-time on a full
Terraformer battle** (perf measured fine in tests but a real board is the test).

### Known follow-up (not blocking)

- **Cost-loop redundancy:** `bestBarrierDenialCandidate`'s cost pass rebuilds the
  AI-team Dijkstra per enemy for a fixed hypothetical (the shortlist bound keeps
  it cheap — ~2 ms — so left as-is). If a large board ever makes it bite, add a
  team-keyed `enemyThreatData` cache. Noted in ADR-0098 §3.

### Guide changelog (new this arc)

`docs/guide-changelog.md` is the one-way feed the parallel guide-writing sessions
read (created in S60). **Append player-facing changes each session; if none, add
the one-line stub** — it's wired into CLAUDE.md's session-end checklist. S61 is
AI-only, so it got a `_No player-facing changes._` stub (the convention working
as intended).

### Loose end to clear (carried, NOT session work)

- **Untracked portraits `src/assets/portraits/templar-male.png` and
  `templar-female.png`** — both present, untracked; left as found per the S60
  brief ("resolve as a one-off — commit or remove"). Decide commit vs. remove.

### Standing carries (unchanged, not addressed)

- Layer-2 positional prediction (only if ever wanted).
- Worldcraft move-then-cast planning (enumeration-cost boundary).
- Full killValue-weighted Math re-base.
- Perch "move onto a created perch" (hypothetical-reach + jump-climb).
- Barrier denial dials: multi-ally protection; speculative/zoning walls; richer
  candidate enumeration (offset-2 / diagonal screens) — all in ADR-0098.
- Default team templates with Terraformer; roster-wide Move-tier discussion;
  Calculator team-template revision; Marshmoor template-compliance tests;
  lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; terrain-transition animation; Calculator AI personality variants;
  Math Skill SP scaling review.

### Untouched by request

- **Uncommitted `guide/` working-tree changes** — none present; every S60/S61
  commit is scoped to game code + docs only.
