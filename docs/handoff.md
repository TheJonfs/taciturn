# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From Session 63 close (2026-06-11) — small-items batch done; log redesign pending

S63 brief was a package: the **action-log redesign** (big rock) + **four small
items** (A–D). The four items are **done and committed to main**; the log
redesign is **not started** and is the natural next session. **1770 → 1775 tests
(+5)**, `tsc -b` + `vite build` clean.

### The four items (all DONE, committed)

| Item | What | Commit | Notes |
|------|------|--------|-------|
| B | Remove Faith from Precision Fire & Targeted Treatment (buff) | `96b3d5f` | New `noFaithScaling` DamageSpec flag; ~2× + deterministic; SP unchanged |
| C | Brine Speed debuff −1 → −2 per cast | `96195ab` | Scoped per-ability magnitude override; Slow untouched |
| D | End-of-battle summary counts every KO (re-KOs included) | `a50ba1d` | Shared walker fix → results screen + MVP + log [ko] rows |
| A | Taunt audit (report-only) + soft-lock guard | `152e842` | Redesign deferred; guard is ADR-0104 |

### Item A — Taunt: redesign deferred, guard shipped

Full audit in `docs/thirtyNinePlanning/taunt-audit.md`. Headline: Taunt's block is
deterministic-not-probabilistic, target-blind, never reflips; the AI is fully
taunt-blind; and a Taunted AI unit whose best action stays blocked **hung the
battle** (stateless AI re-proposes the same rejected action forever). Chris chose
**redesign-later + guard-now**. The guard (ADR-0104, app-layer only) force-ends a
turn when a controller re-submits the byte-identical rejected action; humans are
exempt via their `pending` step. **The Taunt redesign is a future session** — it
needs a new attacker-side hit-chance hook + AI target-preference work, and Chris
must pin the intended effect first (don't invent intent). Pointers in the audit
doc.

### NEXT — the action-log redesign (the big rock, not yet started)

Brief: `docs/thirtyNinePlanning/session-action-log-brief.md`. Concept:
`docs/thirtyNinePlanning/action-log-concept.html` (placeholder palette — do not
copy its colors). **Audit finding (the brief's pivotal structured-vs-strings
question): the log is already STRUCTURED, not baked strings.** The log *is* the
engine `Action[]` stream; `src/ui/action-log-format.ts` is a pure
`Action[] → LogRow[]` render transform, and `src/ui/derived-events.ts` already
does shared single-walk synthesis. So this is **render-layer / Medium, not a
substrate change.** The one wrinkle is **consolidation** (Burn tick + its damage +
its expiry → one line): the data exists in the Action stream but the actions
aren't explicitly parented, so the formatter needs a **grouping pass** (still
render-layer, no engine change). Other pieces: events-vs-state classification,
icon gutter + weight/color (drop `[tick]/[end]/[ko]` text tags), per-turn
collapse/expand, and **KO-timer relocation onto the unit badge** (crosses into
`src/renderer/` unit layer — the one cross-layer bit). **Per the brief, run the
plaintext-review/plan gate with Chris before building.**

### Playtest follow-ups from this session (need Chris's human playthrough)

- **Item B (Calculator buff):** the AI's valuation of Precision Fire / Targeted
  Treatment is re-based **upward (~2×)** since both share `runDamagePipeline`.
  The brief asked to confirm the AI now uses the buffed versions **sensibly** and
  doesn't overcommit. Watch in a battle.
- **Item C (Brine):** −2 Speed is permanent + stacking; eyeball whether the tempo
  swing feels right or wants dialing back toward −1/−2.

### Carried forward from S62 (Templar — still open, NOT acted on this session)

These are Chris design/playtest calls, untouched by S63:

- **Jump triggers reactions** (a bow Counter killed a jumping Templar). Open:
  should a telegraphed Jump grant counter-immunity, or is reaction-counterplay
  intended? (If immunity: suppress reaction triggers for `jumpLeap` damage.)
- **Evasion back-2** — Templar is the first non-zero back-evade (10/6/2); every
  other class is back-0. Authored to concept-spec; flag if you'd rather 10/6/0.
- **Dominant stat = 'ma'** (PA/MA 6/6 hybrid) — could be 'pa'; ±1 at L23/L27.
- **Concept "likely tune down":** Cure range/SP and Jump H6/V6.
- **Two-weapon Jump uses the right-hand weapon** (off-hand ignored; no dual-swing;
  no weapon on-hit procs through Jump). Deterministic/sensible; flag only if you'd
  want Jump to pick the higher-WP / Lance weapon regardless of hand.
- Templar balance/feel (tanky self-sustainer stack, multiplicative healing
  ceiling, Knight+Lance+Jump damage) still needs a human playthrough — the harness
  can't drive PixiJS battles.

### Standing carries (from S61, unchanged — not S63 work)

- **Role-aware deployment sorting** — the last coverage-map consumer (ADR-0094),
  substrate (`threatsToTile`/`buildCoverageMap`) in place. The clean next
  non-content item.
- Barrier denial dials (ADR-0098); Layer-2 positional prediction; Worldcraft
  move-then-cast; killValue-weighted Math re-base; Perch move-onto-created-perch;
  default team templates with Terraformer; roster-wide Move-tier discussion;
  Calculator team-template revision + AI personality variants; Marshmoor
  template-compliance tests; lightning-mage.ts stale S20 header;
  `draft-terraformer-substrate-audit.md` archival; terrain-transition animation;
  Math Skill SP scaling review.
