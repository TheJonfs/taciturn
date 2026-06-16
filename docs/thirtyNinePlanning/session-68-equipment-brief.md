# Session Brief — Equipment Expansion (S68)

*Light content pass: four new team-builder pieces (3 weapons + 1 accessory), all settled
at the parameter level in design conversation. Three compose on existing patterns; only
the Wand of Potential's Spell-Power rider is genuinely new. Design is settled — this brief
operationalizes. (The self-state AI beat is the other, larger half of the forward plan; it
remains to be scoped and can be its own session or join this one later.)*

## Context

Four pieces fill gaps in existing equipment families: a crit-anchor knife, a power-for-tempo
sword, a lightning-support wand, and a contested PA accessory. All gear is unique-per-team
(existing rule), which is what makes the accessory a real allocation decision rather than a
freebie. Numbers are final; see `planner-content-reference.md` for the families they slot
into.

## Inputs

- **`planner-content-reference.md`** — the canonical mechanical reference. Relevant: the
  sword family (Longsword WP 8 / Flametongue / Parrying Sword), the wand family (Depths /
  Deepwood / Lumen, each with an on-hit Resonance), the crit model (base 5%, per-unit,
  ×1.5 multiplier, boosted by Arcane Lens +10%), the magical-damage formula
  `MA × SP × Faith_factor` (so "Spell Power" is the power coefficient), the flat-PA
  accessory pattern (Diamond Bracelet PA +1), and the Sai's existing Speed +1 rider.
- Existing reusable substrate: the Arcane Lens crit-boost contributor; the wand on-hit
  Resonance pattern; the element-tag system (lightning-tagged abilities).

## Goal

Add four `availability: 'available'` pieces, composing where possible:
1. **Vicious Dagger** — Knife, WP 5, Acc 95. +25% crit chance (per-unit), via the existing
   crit-boost contributor at +25%.
2. **Scimitar** — Sword, WP 7, Acc 95. Speed +1 (the Sai's existing rider).
3. **Wand of Potential** — Wand, WP 2, Acc 90. Applies its lightning Resonance on hit (wand
   on-hit pattern, lightning variant) **and** grants +1 Spell Power to lightning-tagged
   magic cast by the holder (new tag-conditional SP contributor).
4. **Gauntlet of Might** — accessory. PA +3 (flat-PA accessory pattern).

## Pre-implementation plan (audit first)

- **Vicious Dagger** — confirm the Arcane Lens crit boost is a composable per-unit
  contributor reusable at +25% (expected yes).
- **Wand of Potential** — confirm the wand on-hit Resonance pattern and whether a lightning
  Resonance variant exists or is net-new; locate the magical-damage/SP path for the
  conditional +1-SP-on-lightning contributor; confirm the lightning element tag on the
  relevant abilities.
- **Scimitar / Gauntlet** — confirm the Speed +1 rider and the flat-PA accessory pattern
  compose cleanly (near-trivial).
- Audit-overturns-spec applies: if any "reuse" point turns out net-new, flag it.

## Implementation work

- **Vicious Dagger** (Knife family — Speed-scaled variance band): +25% per-unit crit via the
  existing crit-boost contributor.
- **Scimitar** (Sword family — Brave-scaled variance band): Speed +1.
- **Wand of Potential** (Wand family): lightning Resonance on hit + the new contributor —
  `+1 SP to lightning-tagged abilities cast by the holder`. Note the intended double
  synergy: the Resonance softens the target's resistance while the SP rider hardens the
  holder's lightning damage, so the wand is a coherent lightning-support piece (Aethurge in
  particular).
- **Gauntlet of Might** (accessory): PA +3.
- All four `availability: 'available'`; they'll auto-appear in the generated reference (§2/§3)
  on the next `build:reference`.

## Acceptance criteria

- All four show in the team builder and equip per the universal weapon/accessory rule.
- **Vicious Dagger**: wielder crit +25 points, stacking additively with base / Arcane Lens /
  Static Embrace's Crit Modifier; applies per-unit (all the wielder's hits, including the
  off-hand under Two Weapons).
- **Scimitar**: WP 7 sword, Speed +1, sword variance band; a sidegrade to the WP 8 Longsword
  (not a strict upgrade).
- **Wand of Potential**: applies the lightning Resonance on hit; the holder's lightning-tagged
  abilities gain +1 SP (verify on Lightning Bolt: SP 12 → 13, ~+8% damage); non-lightning
  magic and non-holders are unaffected.
- **Gauntlet of Might**: PA +3; one-per-team under the existing uniqueness rule.
- Tests for each; full suite green; `tsc -b` + `vite build` clean; `planner-content-reference`
  regenerates with the four rows; an ADR note if the SP contributor warrants one.

## Out of scope

- Further crit-archetype support pieces beyond the dagger (future).
- Rebalancing existing weapons/accessories.
- The self-state AI beat (separate effort) and any AI valuation work — the new effects are
  passive/stat-like and read through existing stat paths; no special AI work this session.

## Files (hedged — audit confirms)

Content: two weapon defs (Vicious Dagger, Scimitar), the Wand of Potential def, the Gauntlet
accessory def; a lightning Resonance config/status if net-new. Engine: the new
tag-conditional SP contributor in the magical-damage path; the crit-boost reuse. Tests
throughout; reference regen; ADR note if warranted.

## Workflow notes

- Mostly composition; one genuinely new piece (the tag-conditional SP contributor). No Chris
  decisions pending — parameters are settled. The only latent tuning is Gauntlet +3 vs +2
  (ship +3, flag for the feel pass).
- Checkpoint isn't really needed mid-session given the size, but flag at the wand if the
  resonance variant or the SP path is bigger than "small contributor."

## Watch-fors

- **Vicious Dagger crit stacking** — base 5 + Vicious 25 + Arcane Lens 10 + a Crit Modifier
  can put a dedicated build past ~40% crit; at ×1.5 that's ~+20% average damage — strong but
  bounded, not a launch blocker. It seeds the crit archetype rather than completing it.
- **Wand SP contributor** — must be tag-gated (lightning only) and holder-gated (only the
  equipper's casts); confirm no leak to non-lightning or non-holder. +1 SP is +1 to the power
  coefficient, so it's proportionally bigger on low-SP spells (Bolt SP 5 → +20%) than high
  (Megavolt SP 36 → +3%) — intended.
- **Gauntlet +3** — potent on the Thief (+9% charm, +9 Steal MP); uniqueness gates it to one
  unit; +2 is the fallback if it reads too strong in the feel pass.
- **Scimitar** — confirmed a sidegrade (one WP for one Speed vs the Longsword), so no Sword-slot
  dominance concern.

## Estimated size

Small — three near-trivial reuses, one small new conditional contributor, tests, and the
reference regen.
