# Session 72 — Enchanter (13th class, Auramancy)

*The dedicated ally-enhancement caster — the role the roster lacks. Fills the buff-application
gap (Haste / Protect / Shell exist today only as equipment auto-status) and feeds the Thief's
buff economy (those buffs become stealable). 6th magical class. Auramancy is support-only by
design; the Enchanter's offense comes from a secondary command set, and Auramancy-as-secondary
hands any class a buff suite. **All four design decisions are settled (see Settled decisions).**
The one residual investigation is the Short Charge form (flat add vs multiplier), routed to the
implementer.*

## Inputs

- This design (spec below).
- The Templar's Cure as the targeting/charge template — **confirm Cure's *current* shape**
  (the S20b snapshot shows it single_unit/instant; it may have changed).
- The ally-buff resolution model: precedent spans Earth's Regen blessing (100%) and Fire's
  embrace / Water's tide-surge (80% baseChance). `computeAbilityChance`, Faith_factor
  `(F_user/100)(F_target/100)`, MA factor — used here to tune the three buffs to ~90% net.
- Action-speed / charge machinery (Livre of Urgency +5 action speed; wand Spell Speed riders)
  for Short Charge.
- The grow-when-hit Saves (Speed Save, Cornered Focus, Updraft) as the Resistance Save pattern —
  including that they accumulate **uncapped**.
- The suppressed Float prototype (2 SP).
- Stat lines (calibration — validated below).

## Goal

Ship the Enchanter: four Auramancy actives (Haste, Protect, Shell, Esuna), an RSM kit
(Resistance Save / Short Charge / Float), and the stat line; tune the three buffs to ~90% net and
register them as stealable so the Thief loop closes.

## Spec

**Stat line** (validated as "a notch below the elemental mages on output, normal mage
durability"): HP 103, MP 40, PA 3, MA 10, Speed 10, Move 3, Jump 2, Eva 6/4/0. Gear:
universal + magical. (MP 40 and MA 10 are the tier-downs vs the elementals' 48 / 12–14; HP 103
is mid-band.)

**Auramancy (primary command set) — four actives.** All diamond-1 AoE, vertical tolerance 1,
actSpd ~30, MP ~8–10 each.
- **Haste / Protect / Shell** — apply Haste (CT-rate up) / Protect (physical damage reduction) /
  Shell (magical damage reduction) to allies in the AoE. **Chance-based, tuned to ~90% net
  likelihood at default Faith 70.** MA-gated (climbs toward always-on as MA is buffed) and
  Faith-of-target-gated — **low-Faith allies are intentionally harder to buff; this tradeoff is a
  feature, not a bug.** Register all three as **stealable positive statuses** (the Thief loop).
- **Esuna** — remove negative-tagged statuses from allies in the AoE. **100%, Faith-independent**
  (removal, not application).

**RSM.**
- **Reaction — Resistance Save** (1 SP): on taking **magical damage**, +10 to all four elemental
  resistances, accumulating **uncapped** (like the other stat-Saves). Tunable up if 10 reads
  modest in playtest.
- **Support — Short Charge** (1 SP): a universal charged-action-speed boost (the Enchanter and any
  class that equips it). **Form is an implementer call** (see pre-implementation): a flat add
  (e.g. +10, front-loads slow ultimates) vs a multiplier (e.g. ×1.25, scales proportionally).
- **Movement — Float** (2 SP): ignore movement penalties of shallow *and* deep water; immunity to
  ground hazards and fall damage. **No combat-elevation effect.**

## Settled decisions

- **D1 — buff resolution:** chance model, **~90% net at default Faith 70**, MA- and
  Faith-of-target-gated; the low-Faith-ally penalty is intended. **Esuna → 100%, Faith-independent.**
- **D2 — Float:** **no elevation bonus** — movement + hazard/fall immunity only, stays 2 SP.
- **D3 — Resistance Save:** trigger on **magical damage**; **no cap** (consistent with the other
  Saves).
- **D4 — Short Charge:** name settled; **form (flat add vs multiplier) is an implementer
  audit/analysis** — recommend at the chunk-2 checkpoint.

## Pre-implementation plan (audit)

- How MA and Faith factors combine for an ally-targeted buff, so the three buffs can be tuned to
  ~90% net at Faith 70 (and the curve toward always-on at high MA / down for low-Faith targets).
- Cure's current targeting/charge (template accuracy).
- **Short Charge form analysis:** model flat-add vs multiplier against the actual actSpd spread
  (basics ~30, ultimates ~18) and recommend — the flat add disproportionately accelerates slow
  ultimates; the multiplier scales evenly. Report at the chunk-2 checkpoint.
- The Float prototype's current state.
- The stat-Save pattern (uncapped accumulation) for Resistance Save.

## Implementation work (chunked)

### Chunk 1 — Auramancy actives  *(checkpoint after)*
Haste / Protect / Shell on the diamond-1 AoE template, tuned to ~90% net at default Faith;
Esuna 100% / Faith-independent. Register Haste / Protect / Shell as stealable positive statuses.
Tune MP (8–10) and actSpd (~30).

### Chunk 2 — RSM  *(checkpoint after)*
Resistance Save (reaction, +10 all-elem-res on magical damage, uncapped); Short Charge (universal
charged-action-speed boost — recommend add vs multiplier here); Float (revive — water-crossing +
hazard/fall immunity, no elevation effect).

### Chunk 3 — class wiring  *(checkpoint after)*
Stat line; class + Auramancy registration; Team Builder / deployment-registry / content-id wiring;
verify the buff economy loop end-to-end (an Enchanter buffs an ally → a Thief Steal-Buffs it).

## Acceptance criteria

- Haste / Protect / Shell land at ~90% net on a default-Faith (70) ally, scale up with MA, and
  scale **down** on a low-Faith ally (the intended tradeoff is observable). Esuna removes
  negative-tagged statuses at 100%, Faith-independent.
- Haste / Protect / Shell are stealable by the Thief's Steal Buffs (verify the loop).
- Resistance Save adds +10 all-elem-res per magical hit and accumulates without a cap; Short Charge
  speeds charged actions for the Enchanter *and* a second class equipping it (form per the chunk-2
  recommendation); Float crosses shallow+deep water and is immune to hazards/fall, with no
  elevation change.
- Stat line matches; class selectable and deployable on all maps.
- Suite green; `tsc -b` + `vite build` clean; ADR (class + the ~90% buff-resolution choice + the
  Short Charge form decision).

## Out of scope

- An offensive Auramancy spell (Gravity/Meteor) — offense rides the secondary command set.
- **Reraise** — deferred; its permadeath interaction is its own design pass.

## Files (hedged — audit confirms)

New class def + Auramancy command set + four actives; Haste/Protect/Shell status defs (+ stealable
tagging) + Esuna cleanse; Resistance Save reaction; Short Charge support; Float (revive); stat
line; Team Builder / registry / content-id registration; ADR; Vitest specs.

## Workflow notes

All four decisions are settled; the only open form-question (Short Charge add vs multiplier) is an
implementer analysis to surface at the chunk-2 checkpoint, not a blocker. The buff statuses being
stealable is an acceptance criterion, not an afterthought. Throttle: chunk 3 wiring is the last
cut; within chunk 2, Float is the most independent piece.

## Watch-fors

- **Protect/Shell shift time-to-kill across the whole roster** — reliable damage reduction is
  balance-significant; flag for the playtest pile, it touches numbers tuned elsewhere.
- The buff-economy / Thief-steal interaction (a stolen Haste/Protect/Shell is now possible).
- The low-Faith-ally penalty should read as *intended texture*, not as a frustrating whiff —
  worth a feel-check that ~90% on normal allies feels dependable while faithless allies feel
  pointedly harder.
- Short Charge over-accelerating ultimates if the flat-add form is chosen (the reason for the
  add-vs-multiplier analysis).
- Resistance Save accumulating uncapped — consistent with the other Saves; observe whether it
  reaches near-immunity in long fights, but no cap by decision.

## Estimated size

Medium. A full class, but the actives are simple buff/cleanse on the Cure template and the RSM are
largely on-pattern (a stat-Save, an action-speed Support, the revived Float). The depth is in the
buff tuning and the Short Charge form analysis, not novel substrate — lighter than the Thief.
