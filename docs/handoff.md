# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S68 (continued) — Vantage shipped (2026-06-17)

The Hunter's two-hander/bow Support brainstorm resolved into **Vantage** and is
on main. **1909 → 1916 tests; tsc -b + vite build clean; planner reference
regenerated.** ADR-0115.

### What shipped

**Vantage** (passive, Support, baseCost 1, **free on the Hunter** as its 2nd
free Support): *the wielder's own attacks resolve as if it stood +2 tiles
higher.* New closed-surface hook `modifyAttackerElevation` (16→17) +
`runModifyAttackerElevation`. Threaded — **with full parity** — through every
attacker-side offensive elevation read:
- height_delta damage variance (`resolvePhysicalVarianceBand` — live + AI
  projection + UI forecast share it),
- ±5% high-ground accuracy (`computeElevationModifier` gained an optional bonus
  param; live `evasionCheck`, forecast `computeOutgoingHitChance`, projection's
  private copy),
- bow reach-from-height (`rangeFromHeightBonus` source) and attack-LoS source
  ("shoot over cover") in `validate.ts`, AI `basic.ts` offense, and
  `coverage-map.ts` **threat model** (AI fears a Vantage enemy — Chris's call),
- `inRange` vertical stays **raw** (vertical-range excluded — counter-thematic).

Scope (all confirmed with Chris): **attacker-only**, never defensive / Math
Skill / pathfinding / knockback / AoE. **X = 2** is the deliberately-spicy first
cut. **LoS applies to spells too** — intended: an Aethurge's Lightning Bolt can
clear a Terraformer Barrier (the regression test pins exactly this).

### Follow-ups

1. **DoT re-analysis — DONE, and it drove a bow buff.** The tempo-normalized
   re-run showed the bow Hunter was the *lowest-output* build even with the
   stat buffs + Vantage + high ground — accuracy-starved (bow acc 33, single
   low-WP swing). So instead of dialing Vantage down, we **buffed both bows**
   (Longbow acc 33→40 / WP 7→9; Riptide acc 33→40 / WP 5→7; "Case B"). The
   design intent (Chris): flat-ground Hunter stays well below the front line;
   a **perched** Hunter (earned high ground + Vantage) now out-damages the
   Knight — making "seize/build the high ground" a real party goal. **X=2 kept**
   (one constant `VANTAGE_ELEVATION_BONUS`; still trivially retunable).
2. **Playtest watch:** confirm the perched-vs-flat split *feels* right on
   elevation-rich maps (the perched Hunter beating the Knight is intended, but
   verify it reads as "earned," not oppressive). `playtest-watch.md` updated.
3. The **MA-5 plant** still anticipates a future magic-leaning Hunter secondary
   command set (no content yet).

### Watch / known limitations

- **Forecast/AI model only the dominant swing for dual-wield** (pre-existing,
  from ADR-0114; untouched). Orthogonal to Vantage.
- **Vantage on a non-bow straight-line caster** is a real cross-class splash
  (shoot-over-cover for spells). Intended, but watch that it doesn't trivialize
  cover for mages generally — it's a 1-point Support any caster can take.
- The S68 equipment feel-pass items still pending (Gauntlet +3, Vicious crit) —
  `playtest-watch.md`.

## Still open, NOT touched (carried)

- **Taunt redesign** — deferred; needs an attacker-side hit-chance hook + AI
  taunt-awareness; Chris must pin intended effect
  (`docs/thirtyNinePlanning/taunt-audit.md`).
- **Templar (S62) balance/feel**; **Thief feel pass** (Momentum / Steal MP /
  charm) — all in `playtest-watch.md`.
- **S61 standing AI carries**; **MP-penalty scope (S66, ADR-0109)**;
  **deployment taxonomy (S66)**; default team templates with the newer classes
  + S68 gear/Vantage; `lightning-mage.ts` stale S20 header;
  `draft-terraformer-substrate-audit.md` archival.
