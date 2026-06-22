# ADR-0122 — Aura Mastery: caster-side buff-magnitude amplification

**Status:** Accepted
**Session:** 72 (2026-06-22)
**Relates:** ADR-0120 (Enchanter / cast-buff sibling types), ADR-0121 (Protect/Shell as magnitude-driven multipliers), ADR-0028 (compose-via-existing-hook / `modifyStatusApplicationChance` precedent).

## Context

The Enchanter wanted a second Support: a buff-amplifier that makes the buffs the
wielder casts land *stronger* — deeper Haste / Protect / Shell, and, when worn by
a Geosage or Calculator, deeper Regen and Engineered Defenses too. The challenge
was doing it without (a) a hardcoded status list, (b) inflating the wrong things
(flat stat points, reaction self-buffs, equipment grants), or (c) mishandling the
one buff whose magnitude is a multiplier rather than an additive value (Haste).

## Decision

A new closed-surface hook, **`modifyOutgoingStatusMagnitude`**, fired against the
**caster's** hooks at status apply time (`engine/status/apply.ts`, where magnitude
is resolved from `args.magnitude ?? type.defaultMagnitude`). It scales the
magnitude that gets baked into the new instance. Sibling to the caster-side
`modifyStatusApplicationChance` (which scales *chance*).

**Curation is content-driven**, via two new `StatusEffectType` fields:

- `amplifiable?: boolean` — opt-in. Only flagged statuses are scaled.
- `magnitudeKind?: 'additive' | 'multiplier'` — how to scale:
  - additive: `magnitude × K`
  - multiplier: `1 + (magnitude − 1) × K` (scale the *bonus*, not the whole multiplier)

**Gating** (so only deliberate casts are amplified): the apply path runs the hook
only when there is a real caster (`sourceUnitId !== null`) and
`sourceKind !== 'equipment'`. Equipment grants (Boots of Haste, Sorcerer's Robe,
Circlet, Tintinibar, Defender) are never amplified. Combined with the cast-vs-
equipment **type split** (ADR-0120) — flag `quickening`/`protect_cast`/
`shell_cast`/`regen`, not their permanent equipment twins — the equipment
exclusion is doubly enforced.

**The support — Aura Mastery** (`aura_mastery`): Support, baseCost 1, free for the
Enchanter (its second native Support; with capacity 3 it pairs with Short Charge).
Registers `modifyOutgoingStatusMagnitude` with **K = 1.33** (paralleling Short
Charge's ×1.33) and the kind-aware math above. The policy lives in the ability;
the per-status opt-in lives on the statuses, so new content participates by
tagging its status — Aura Mastery never needs re-touching.

**Flagged v1 set:** `quickening` (cast Haste — multiplier), `protect_cast`,
`shell_cast`, `regen` (cast), `engineered_defenses`, `crit_modifier` (all
additive). **Left unflagged:** equipment grants (`haste`, `protect`, `shell`,
`regen_auto`, `mana_font`) and flat stat-point / reaction self-buffs (`pa_up`,
`ma_up`, `movement_self_buff`, `updraft`, `speed_save`, `cornered_focus`,
`combat_focus`, `resistance_save`).

**Regen prerequisite refactor:** Regen's per-tick heal was a hardcoded
`Faith × COEFFICIENT × MaxHP` with the instance magnitude unused. It now folds
magnitude in as a coefficient scalar (`× magnitude`), with `defaultMagnitude: 1`
on both `regen` and `regen_auto` (so unamplified behavior is bit-identical). Only
cast `regen` is flagged `amplifiable`; the shared `regenOnTick` reads
`ctx.instance.magnitude`.

## Worked numbers (K = 1.33)

| Buff | base magnitude | amplified |
|---|---|---|
| Haste (`quickening`, multiplier) | 1.5 | 1.665 (= 1 + 0.5×1.33) |
| Protect / Shell (% reduction, additive) | 50 | 66.5 (≈ ×0.335 damage) |
| Crit Modifier (additive) | 20 | 26.6 |
| Engineered Defenses (per-stack, additive) | 1 | 1.33 |
| Regen (coefficient, additive) | 1 | 1.33 |

## Consequences

- **Baked at apply time:** amplified buffs persist at their boosted magnitude, are
  stealable at that magnitude (a Thief lifting an amplified Haste gets the stronger
  one), and a later removal of the support doesn't un-boost an already-cast buff.
- **AI:** no change — the boost is on the instance, so the AI's damage projection and
  buff reads see the stronger values for free.
- **Authoring guidance** added to `docs/design/status-effects.md` ("Amplifiable
  buffs") + a note on the `StatusEffectType` fields, so future magnitude-bearing
  buffs get the `amplifiable`/`magnitudeKind` decision baked into their behavior.
- Fractional magnitudes (66.5, 1.665, 1.33) propagate fine — resistance/crit/coeff
  are non-integer-tolerant and Speed floors on read. Protect/Shell clamp the factor
  at 0, so over-amplification trends toward immune, never negative.
- Closed-hook surface grows by one (`modifyOutgoingStatusMagnitude`); per ground
  rule 8 this is a deliberate engine change, captured here.

## Balance watch

K = 1.33 on Protect/Shell (50% → 66.5% reduction) and Haste (×1.5 → ×1.665) is a
real potency bump on an Enchanter who can run Short Charge *and* Aura Mastery (fast,
strong auras). Flagged for the playtest pile; K is a single-constant lever.
