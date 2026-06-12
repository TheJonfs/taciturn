# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From the team-builder redesign session (2026-06-11) — both passes shipped

The team-builder brief (`docs/thirtyNinePlanning/session-team-builder-brief.md`)
shipped in full, committed to main. **1781 → 1793 tests; tsc -b + vite build
clean; browser-verified end to end.**

- **Pass 1** (`3f6cdc5`): the frame — central unit card (larger portrait + level
  pin; identity/Brave/Faith consolidated; complete live stat line *including
  Move and Jump*, read from the engine resolver); class-picker-as-mode (the rich
  grid reopens on "Change class", collapses on pick); leveled lineup (already
  existed). Audit found the deepest risk pre-solved — stats were already
  engine-computed; item 1 was a pure display gap.
- **Pass 2** (`6f31e11`): the editors — grouped/sorted/**searchable** equipment
  picker (slot pills → open candidate list by weapon family); **abilities
  accordion** (one category open at a time; collapsed = picks + budget; open =
  budget meter + cost pips); shared **context inspector** (equipment delta vs
  equipped / ability budget-fit); hand-rolled inline-SVG icon set. New
  `weaponType` field on weapons (**ADR-0105**). Content-integration sweep:
  lifted the triplicated two-handed/dual-wield/Monkeygrip predicates into shared
  `team-builder-state` helpers (`unitGrantsDualWield`, `unitGrantsTwoHandedGrip`,
  `equipmentOptionsForSlot`); the per-component copies are gone.

### Team-builder follow-ups (Chris's calls)

- **Parchment reskin is still its own future pass.** Built against the dark
  theme per the brief; the Ivalician skin was explicitly out of scope.
- **Inspector is mechanical-only** (Chris's call). The concept's authored flavor
  prose ("Deepwood-strung and tide-blessed…") has no shared home — it lives only
  in the Guide's `guide/content/prose.ts` (a separate Vite project). A future
  "single-source flavor" content pass would lift item/ability flavor into
  `src/content` so the inspector and Guide read one source. Not started.
- **`weaponType` has no engine consumer yet** (ADR-0105) — display/classification
  only. It's the designated hook if a future mechanic keys on weapon family
  (a class that only equips knives, a per-family passive).
- **Icons are placeholder-quality.** Hand-rolled inline SVGs, wayfinding-only.
  Easy to retune; not final art.
- **Visual review for Chris:** click through the rebuilt builder. The two concept
  states are reproduced (unit card + accordion; opened equipment slot with the
  grouped/searchable list + delta inspector). The console shows stale Vite HMR
  reload errors from the *editing* session — they are not current; the page
  loads clean on a hard reload (verified).

### Still open, NOT touched this session (carried from S63 — Chris design/playtest)

These were noted at session start as Chris-side calls that don't block the
team-builder work; left untouched, so they carry forward:

- **Action-log redesign** (`b3bd121`, S63) — shipped but its pixel-level visual
  is unverified (harness can't drive PixiJS). Needs Chris's in-battle pass vs
  `action-log-concept.html`; decisions to confirm in the S63 close notes (git log
  `be7540e`/`8a712dc`): per-row click-to-expand removed, Burn ", expired"
  annotation dropped, charged-action resolves open their own T-number group.
- **Taunt redesign** — deferred; soft-lock guard shipped (ADR-0104). Needs a new
  attacker-side hit-chance hook + AI taunt-awareness; Chris must pin the intended
  effect first. Full audit in `docs/thirtyNinePlanning/taunt-audit.md`.
- **Calculator buff (Item B) + Brine (Item C)** playtest feel — need a human
  playthrough (AI re-valuation of Precision Fire/Targeted Treatment ~2× up;
  Brine −2 Speed permanent + stacking).
- **Templar (S62)** open design/feel calls: Jump-triggers-reactions counterplay,
  back-2 evasion, dominant stat ma vs pa, Cure range/SP + Jump H6/V6 tune-down,
  two-weapon Jump right-hand rule, overall tanky-self-sustainer balance.
- **S61 standing carries:** role-aware deployment sorting (last coverage-map
  consumer, ADR-0094 substrate in place — the clean next non-content item);
  Barrier denial dials; Layer-2 positional prediction; Worldcraft move-then-cast;
  killValue-weighted Math re-base; Perch move-onto-created-perch; default team
  templates with Terraformer; roster-wide Move-tier discussion; Calculator
  team-template revision + AI personality variants; Marshmoor template-compliance
  tests; lightning-mage.ts stale S20 header; `draft-terraformer-substrate-audit.md`
  archival; terrain-transition animation; Math Skill SP scaling review.
