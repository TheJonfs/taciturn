# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From Session 65 (2026-06-13) — Knight content + equipment + MP economy + Barrier audit

Shipped the full S65 brief to main across four commits. **1804 → 1819 tests; tsc -b
+ vite build clean.** ADR-0108 captures the decisions.

- **Barrier remedy A (widened):** all four Assassin darts (Blowdart, Shadow Stitch,
  Undermine, Sow Doubt) flipped arc → straight_line. The audit confirmed bows and
  lobbed/area attacks are deliberately arc and stay; the darts were the genuine
  mis-fit (Chris chose the whole family over Blow-Dart-only). Remedies B/C
  (categorical / height-aware arc) parked — not needed.
- **Knight:** Taunt suppressed off the Battle Skill set (ADR-0104 guard stays;
  Taunt still catalog-registered, cross-class). Bull Rush added — weapon attack,
  6 MP, 1.0× damage, Brave×PA-gated one-tile knockback (baseChance 85 → ≈0.79 on a
  baseline Knight). Rides the existing knockback substrate, so knock-into-hazard
  fall damage works.
- **PA_factor** (`0.9 + PA/10`) shipped at both chance-compute sites — the
  ADR-0028 deferral, Bull Rush is the first consumer. **Lightning Stab** moved to
  the same `{ brave, pa }` shape (was `{ brave, ma }`), baseChance recalibrated
  50 → 34 to **hold** its prior Silence rate (formula consistency, not a buff).
- **Equipment ×3:** Circlet (mage head; +10/+10, grants new `mana_font` status =
  per-turn MA/2 MP regen via onTick → system_mp_restore), Barbut (heavy head,
  Knight/Templar; +30 HP + Stop/Don't Move/Don't Act ×0.5), Battlemage's Chain
  (Heavy body, Knight/Templar; +80 HP / +10 MP / +1 MA).
- **MP rebaseline:** four elemental mages 60→48, Calculator 47→37, Terraformer 35
  (unchanged), martials unchanged.

### Things noticed / for Chris

- **Barbut and Focus Band are both head slot → they never co-stack on one unit.**
  The brief asked how the resists stack (engine answer: multiplicatively, ×0.5 ×
  ×0.75 = ×0.375), but in practice they're mutually exclusive alternatives. The
  engine composition is correct; just won't co-occur via these two items. Logged
  in playtest-watch so a future "stacking looks off" report isn't chased.
- **All S65 verification is unit-test-only.** The harness can't drive PixiJS
  battles, so the *feel* of Bull Rush knockback, the dart LoS change, Circlet
  sustain under the tighter MP economy, and the Barbut earning its slot all need
  Chris's in-battle pass. See the new S65 block in `docs/playtest-watch.md`.
- **Roadmap unchanged** — S65 is a content/tuning pass under the standing
  "class/ability/equipment expansion" track; no sequencing or scope shift.

### Still open, NOT touched this session (carried)

- **AI MP economy** (newly sharpened by the rebaseline) — the scorer doesn't pace
  MP or value sustain; AI mages may run dry harder than humans now. Flagged in
  playtest-watch; an AI MP-pacing pass is the future lever if it bites.
- **Team-builder follow-ups** (S64): parchment reskin; single-source flavor
  content pass (inspector is mechanical-only; flavor lives only in the Guide);
  `weaponType` has no engine consumer yet (ADR-0105); placeholder icons.
- **Action-log redesign** (S63, `b3bd121`) — shipped, pixel-level visual still
  unverified; needs Chris's in-battle pass vs `action-log-concept.html`.
- **Taunt redesign** — still deferred (this session was suppression only). Needs an
  attacker-side hit-chance hook + AI taunt-awareness; Chris must pin intended
  effect. Audit in `docs/thirtyNinePlanning/taunt-audit.md`.
- **Templar (S62) balance/feel calls** — now compounded by Battlemage's Chain
  feeding the tanky-self-sustainer (watch entry added).
- **S61 standing carries:** role-aware deployment sorting (the clean next
  non-content item — ADR-0094 substrate in place); Layer-2 positional prediction;
  Worldcraft move-then-cast; killValue-weighted Math re-base; Perch
  move-onto-created-perch; default team templates with Terraformer; roster-wide
  Move-tier discussion; Calculator team-template revision + AI personality
  variants; Marshmoor template-compliance tests; lightning-mage.ts stale S20
  header; `draft-terraformer-substrate-audit.md` archival; terrain-transition
  animation; Math Skill SP scaling review.
