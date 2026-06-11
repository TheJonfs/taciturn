# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 62 close (2026-06-11) — TEMPLAR ARC COMPLETE

S62 opened *and finished* the Templar arc — a hybrid White Mage + Dragoon for the
Glabados Church. Audit-first, then **all five build-order steps** in one session.
**1721 → 1765 tests (+44)**, `tsc -b` + `vite build` clean. **Five ADRs: 0099–0103.**
**The Templar is a registered, playable class.**

### The arc, end to end (all DONE)

| Step | What | ADR |
|------|------|-----|
| Audit | T1–T9 exists/compose/net-new; faith + Auto-Protect found pre-existing | — |
| 1 Foundation | Faithstrider (Move passive), Defender (Knight Sword + Auto-Protect), portraits | — |
| 2 | Cure rework (charged AoE heal), Raise (revive substrate), Monkeygrip | 0099, 0100 |
| 3 | On-heal hooks → Unified Calling + Emissary | 0101 |
| 5-sub | Lance pierce + Lance / Imp Halberd weapons | 0102 |
| 4 | **Dragoon Jump** — off-field leap, 3×Speed charge, lance ×2 | 0103 |
| 5 | **Class assembly** — stat block, Templar Arts command set, 4 innates, gear permission | — |

Substrate net-new this arc: `removeKO` ability effect (Raise), `relaxesTwoHandedGrip`
(Monkeygrip), two on-heal hooks (`onHealingReceived` + `modifyOutgoingHealing`), the
`airborne` unit state + `chargeSpeedFromUnitSpeed` + `lanceBonus`/`jumpLeap` (Jump),
`pierces` weapon flag + `'lance'` tag (pierce). Everything else composed on existing
faith / healing / charged-action / AoE substrate.

### Commits (all to main — Chris is sole worker)

`5343219` portraits · `e2cc34f` Faithstrider+Defender · `b4b99b1` Cure · `991450c`
Raise/0099 · `c159426` Monkeygrip/0100 · `3747a82` on-heal hooks/0101 · `bddf3df`
Lance pierce/0102 · `5d75929` Jump/0103 · `0435d04` class assembly. Plus doc commits
along the way. Guide-changelog has the full player-facing writeup (class + each piece).

### NEXT — this is a PLAYTEST phase, not a build phase

The class is assembled and unit-tested, but its *feel* is unverified. The harness
can't drive PixiJS battles, so this needs **Chris's human playthrough**. The
concept-notes' explicit playtest watch-items (now live):

- **Tanky self-sustainer (Chris's planned degenerate test):** Defender's Auto-Protect
  (50% physical) + Monkeygrip shield + Knight head/body + self-Cure + the Unified
  Calling MP loop = a very durable, self-refuelling, low-threat wall. Levers:
  Auto-Protect magnitude (currently 50%, tunable via a magnitude-carrying statusGrants
  variant) and HP 132. **Sanity-check HP 132 vs the Knight given this stack.**
- **Multiplicative healing stack:** Emissary (×1.25) × Faithstrider (faith ↑) × Imp
  Halberd (MA +1) × high-faith targets compound (~1.5–1.7× a fully-invested heal).
  Eyeball the ceiling.
- **Knight + Lance + Jump** (PA 12 × WP × 2, H6/V6) — the Jump damage ceiling. Raidable:
  any class can take Templar Arts. Telegraphed/dodgeable/MP-costed, but the number to watch.
- **Knight + Lance pierce** — two-target efficiency at PA 12.
- **Roster sustain:** a second full heal+revive package (alongside Alchemist) trends
  games toward attrition; interacts with the AI item-vs-kill scoring.
- **Cure range/SP, Jump H6/V6** — concept-notes flag both as "likely tune down."

### Decisions made this session that Chris may want to revisit (flagged, not silent)

- **Evasion back-2.** The Templar's evasion is 10/6/2 per the concept-notes — but
  **every other class has back-0** ("uniform back-zero" per the Knight). The Templar is
  the first non-zero back evade. Authored to spec; flag if you'd rather it be 10/6/0.
- **Dominant stat = 'ma'.** PA/MA hybrid (6/6); MA took the single dominant-stat pick
  (Terraformer precedent, healing identity). Could be 'pa' if you prefer the Dragoon
  half to drive level scaling. Minor (±1 at L23/L27).
- **Command set = one set (Templar Arts = Cure/Raise/Jump).** Per concept-notes. So a
  raider gets Jump along with the healing — intended (it's the "Knight + Lance + Jump"
  watch-item).

### Deferred / known-incomplete (not blocking; noted in ADRs)

- **Jump rendering (ADR-0103):** the renderer draws the airborne jumper on its tile
  during the charge — it won't visually "lift off." Mechanically correct (untargetable);
  a sprite-lift/shadow is future polish.
- **Jump airborne-clear** only happens in `finalizeResolution`; a future charge-cancel
  path outside it must also clear `airborne`.
- **Pierce v1 limits (ADR-0102):** pierce takes precedence over multi-weapon dual-swing
  (one line, not two); cardinal-only direction; vertical tolerance 1.
- **Unified Calling uses base PA** (emission hooks get only the unit snapshot); effective-PA
  scaling is a possible refinement.
- **Regen excluded** from both on-heal hooks (structural; per the one-time-source scope).

### Roadmap

`docs/roadmap.md`'s per-session log was abandoned ~S20b; the Templar arc is captured
in the `thirtyNinePlanning/` brief + concept-notes + these 5 ADRs + the guide-changelog.
The arc falls under the existing "Class/ability/equipment catalog expansion" content-pass
— no roadmap edit made.

### Standing carries (from S61, unchanged — not Templar work)

- **Role-aware deployment sorting** — the 4th/last coverage-map consumer (ADR-0094),
  deferred behind the Templar arc. Substrate (`threatsToTile`/`buildCoverageMap`) in place.
  Now the clean next non-content item.
- Barrier denial dials (ADR-0098); Layer-2 positional prediction; Worldcraft move-then-cast;
  killValue-weighted Math re-base; Perch move-onto-created-perch; default team templates with
  Terraformer; roster-wide Move-tier discussion; Calculator team-template revision + AI
  personality variants; Marshmoor template-compliance tests; lightning-mage.ts stale S20
  header; `draft-terraformer-substrate-audit.md` archival; terrain-transition animation;
  Math Skill SP scaling review.
