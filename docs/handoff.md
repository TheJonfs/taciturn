# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From Session 66 (2026-06-14) — AI capability expansion: knockback, MP economy, deployment

Shipped the full S66 brief to main across four commits (chunks 1–3 + a test
fix split out of chunk 2). **1823 → 1853 tests; tsc -b + vite build clean.**
ADR-0109 captures the three terms and the D1–D3 calls.

- **Chunk 1 — knockback value (D1: consequence-only).** The scorer folds the
  expected knock-into-hazard fall into offensive scores via the engine's own
  `applyKnockback` + the shared `fallValueForOccupant` (factored out of
  `scoreWorldcraftFall`), weighted by `computeAbilityChance` (the pure compute
  extracted from `rollAbilityChance`). Single-target (Bull Rush) **and** AoE
  (Tidal Wave / Maelstrom; ally-into-hazard signed as a cost). Gated on the
  target surviving the direct hit. Audit confirmed the AI had zero prior
  knockback awareness — real evaluation work, not wiring.
- **Chunk 2 — MP economy (D2: soft penalty only).** `mpSpendPenalty` subtracts a
  convex scarcity-scaled penalty `(1-mp/maxMp)²` from an action's MP cost; bounded
  and subordinate (a high-value cast still wins). Applied **inside the leaf
  scorers** (offence single/AoE + ally-buff) so the joint planner's internal
  comparison sees it. Ether restore-valued higher as the recipient runs dry.
  **Scoping (deliberate, flag if revisiting):** penalty covers offence + buff
  only — **not** heal / Math / Worldcraft (avoids support-cower; leaves those
  tuned dials alone). Extending to them is a small follow-up if their MP pacing
  looks off in play.
- **Chunk 3 — role-aware deployment (D3: coarse melee/ranged via weaponType).**
  `deployRoleFromWeaponType` (bow/wand/staff → ranged; else melee) — **this
  retires the banked `weaponType` hook (ADR-0105), its first consumer.**
  `planAiDeployment` ranks tiles by forwardness and seats melee front / ranged
  behind. Audit-overturns-spec: the brief's "coverage map" doesn't fit pre-
  placement deployment (no placed units); distance-to-opposing-centroid is the
  exposure proxy. Captured in ADR-0109 + the file header.

### Needs Chris's in-battle feel pass (harness can't drive PixiJS)

All S66 validation is unit-test-only. New watch block in `docs/playtest-watch.md`
covers all three:
- **MP cower watch** (the named risk): a low-MP mage must still cast high-value
  spells and only conserve on marginal ones — not hoard and freeze. Dials in
  `basic.ts` (`MP_SPEND_PENALTY_WEIGHT 1.5`, the curve, `MP_RESTORE_SCARCITY_BONUS
  1.0`).
- **Knockback feel:** Bull Rush picked over Attack only when a hazard is in the
  shove line; AoE knockback avoids shoving allies into pits.
- **Deployment formation:** melee front / casters behind reads coherently on real
  maps; casters not stranded too far back to act turn 1.

### Decisions for Chris when convenient

- **MP-penalty scope** — extend to heal/Math/Worldcraft for uniform MP economy,
  or keep offence+buff-only? (Left scoped this session; see ADR-0109.)
- **Deployment taxonomy** — coarse melee/ranged shipped; a richer
  tank/skirmisher/artillery/support split is the deferred next step if the coarse
  one feels blunt.

### Housekeeping noticed

- `docs/thirtyNinePlanning/{session-66-brief.md, ai-capability-expansion-blueprint.md}`
  are untracked in git — planning artifacts; committed this session alongside the
  docs so they're versioned.
- **Roadmap unchanged** — S66 is AI-track work tracked via ADR-0109 + this
  handoff, not a numbered mechanism-track roadmap item (same rationale as S65).

### Still open, NOT touched this session (carried from S65/S61)

- **Action-log redesign** (S63, `b3bd121`) — shipped; pixel-level visual still
  unverified vs `action-log-concept.html`.
- **Taunt redesign** — deferred (S65 was suppression only). Needs an attacker-side
  hit-chance hook + AI taunt-awareness; Chris must pin intended effect. Audit in
  `docs/thirtyNinePlanning/taunt-audit.md`.
- **Templar (S62) balance/feel** — compounded by Battlemage's Chain feeding the
  tanky self-sustainer (watch entry exists).
- **Team-builder follow-ups (S64):** parchment reskin; single-source flavor pass
  (inspector mechanical-only; flavor only in Guide); placeholder icons.
- **S61 standing AI carries** (role-aware deployment now DONE, removed): Layer-2
  positional prediction; Worldcraft move-then-cast; killValue-weighted Math
  re-base; Perch move-onto-created-perch; default team templates with Terraformer;
  roster-wide Move-tier discussion; Calculator team-template revision + AI
  personality variants; Marshmoor template-compliance tests; lightning-mage.ts
  stale S20 header; `draft-terraformer-substrate-audit.md` archival; terrain-
  transition animation; Math Skill SP scaling review.
