## ADR-0113: `modifySpellPower` hook — tag-conditional Spell Power riders

**Status:** Accepted
**Date:** 2026-06-16

## Context

Session 68 ships the Wand of Potential, a lightning-support wand whose
defining rider is "+1 Spell Power to the holder's lightning-tagged magic."
"Spell Power" is the magical damage formula's power coefficient
(`baseDamage = MA × SP × Faith_factor`, `magicalMaPower` in
`src/engine/damage/handlers.ts`). No existing surface let *equipment* modify
that coefficient:

- The damage pipeline's `additionalPowerCoefficient` thread exists, but it's
  set at the `resolveAbilityEffect` call site (Math Skill's Mathematician +1
  SP rides it) — there was no equipment-driven contributor feeding it.
- Every other tag-conditional weapon rider (Wand of Deepwood's `+5` actionSpeed
  on Earth casts, Wand of Depths' `+1` range on Water casts, Arcane Lens' hit-
  chance multiplier) is implemented the same way: an optional data field on
  `EquipmentDefinition` read by a per-hook contributor in
  `engine/items/contributions.ts`, dispatched through the closed hook surface.

The rider must be **tag-gated** (lightning only) and **holder-gated** (only the
equipper's casts). Both gates fall out naturally from the existing machinery:
the contributor walks the *caster's* equipment (holder gate), and the damage
handler that fires it is gated on the `'magical'` tag with the contributor
gating on the ability's damage tags (lightning gate).

Two implementation options were weighed (with Chris):

1. **New closed-surface hook** `modifySpellPower` + `spellPowerModifiers` data
   field — mirrors `modifyActionSpeed` / `actionSpeedModifiers` exactly.
2. **Inline weapon read** in `magicalMaPower` — no new hook; read the
   attacker's equipped weapon directly for a `spellPowerModifiers` field.

## Decision

**Option 1 — add `modifySpellPower` to the closed hook surface.**

- Hook signature `modifySpellPower { unit, ability, baseValue } → number` in
  `engine/hooks/hooks.ts`; runner `runModifySpellPower` (additive chain over
  `baseValue: 0`) in `engine/hooks/runners.ts`.
- Optional `spellPowerModifiers?: ReadonlyArray<SpellPowerModifier>` on
  `EquipmentBase`; `SpellPowerModifier = { delta, tagFilter? }`. The
  `spellPowerContributor` in `engine/items/contributions.ts` yields one
  additive, tag-gated handler per entry — a byte-for-byte structural twin of
  `actionSpeedContributor`.
- `magicalMaPower` fires the chain once against the caster and adds the
  returned delta to the effective power coefficient.

**Why the hook over the inline read** (per ground rules #8 and #9): rule #9
says statuses, equipped passives, equipment, and class traits should all reach
a mechanism through the *same* hook surface. The inline-weapon read would lock
Spell Power modification to the equipped-weapon slot forever; a future
"Focus" status or a caster class trait that grants +SP could not compose. The
new hook keeps the surface uniform — adding it is the deliberate engine change
rule #8 calls for, recorded here.

## Consequences

- **AI / UI inherit it for free.** `src/ai/projection.ts` reuses the live
  `runDamagePipeline`, so projected/forecast damage already reflects the rider
  with no separate read-site (the same sharing discipline as `readCritChance`
  / `resolvePhysicalVarianceBand`). No AI valuation work was needed — the
  effect reads through the existing magical-damage path (S68 brief scope).
- **Magical-only by construction.** The rider lives in `magicalMaPower`, gated
  on the `'magical'` tag, so physical attacks that happen to carry an element
  tag (Lightning Stab: `['physical', 'lightning']`) and healing never see it.
- **Proportional to base SP.** +1 SP is a larger relative bump on low-SP spells
  (Bolt 5 → 6, +20%) than high (Lightning Bolt 12 → 13, +8%) — intended; the
  flat +1 is the simplest expression of "a little more lightning punch."
- Closed hook surface grows 15 → 16.

## Alternatives considered

- **Inline weapon read** — rejected per rule #9 (see above); smaller but
  non-composable.
- **Reusing `additionalPowerCoefficient` via a new call-site equipment walk** —
  rejected: it would duplicate the equipment-contribution collection logic
  outside the hook collector and couldn't be gated per damage tag without
  re-implementing the ability-tag inspection the contributor already does.
