## ADR-0127: Per-extra-target Spell Power (Glove of Metria)

**Status:** Accepted
**Date:** 2026-06-26

## Context

S74 wanted Glove of Metria: MA +1, and a spell hitting multiple targets gains
+1 SP per target beyond the first — a reward for casting wide.

Chain Lightning already scales power by cluster size: `effectivePowerCoefficient`
reads `DamageContext.targetCount` and adds `chainBonus.powerPerAdditionalTarget ×
(targetCount - 1)`. But `chainBonus` is **ability-data-driven**, not
equipment-driven. The S68 `modifySpellPower` hook (Wand of Potential's +1 SP on
lightning magic) is equipment-driven but contributes a **flat** per-cast delta —
its hook args carry no `targetCount`, so it can't scale with cluster size.

The audit also established that **Math Skill threads `targetCount` like AoE**
(`resolveMathSkillDispatch` sets `targetCount: matched.length`), so a
target-count-scaled SP rider auto-applies to field-wide Calculator casts unless
explicitly excluded.

## Decision

Thread the cast's `targetCount` into the `modifySpellPower` hook (an arg-field
extension on an existing hook, not a new hook) and extend `SpellPowerModifier`
with `perExtraTarget?: boolean`. When set, the contribution scales as
`delta × max(0, targetCount - 1)` — single-target casts get nothing, a 3-cluster
gets +2×delta, a field-wide 5-target Math cast gets +4×delta. The magical damage
handler passes `ctx.targetCount`; `runModifySpellPower` forwards it; the
spell-power contributor reads the flag.

- **Magical-only by construction:** `modifySpellPower` fires only inside
  `magicalMaPower`, so the rider never touches physical or healing.
- **Applies everywhere, including Math Skill (Chris's call).** Because Math Skill
  threads `targetCount`, the Glove amplifies a Calculator's field-wide casts.
  This was the explicit D3/D4 decision — apply everywhere and tune from playtest
  rather than special-case-excluding Math Skill.

Glove of Metria: `{ statMods: { ma: 1 }, spellPowerModifiers: [{ delta: 1,
perExtraTarget: true }] }`.

## Consequences

- The Glove rewards the AI's own S73 cohesion clustering (allies gather → AoE
  buffs/attacks hit more → more SP) and punishes the enemy for bunching. SP is
  the magical power coefficient (`baseDamage = MA × SP × Faith`), so +1 is
  proportionally larger on low-SP spells (Precision Fire SP 3 → +33% per extra
  target) than high — intended.
- Field-wide on a Calculator it compounds the curve the Ring also pressures (the
  batch epicenter). Uncapped on purpose; a playtest-watch item.
- Any future "scales with how wide you cast" SP rider reuses the flag.

## Alternatives considered

- **A new target-count-scaled hook.** Unnecessary — `modifySpellPower` already
  composes through the live pipeline (so AI projection / UI forecast inherit it);
  it only lacked `targetCount` in its args.
- **Exclude Math Skill.** Considered (it caps the field-wide blowup) but declined
  this session — Chris chose the everywhere version to playtest the strong
  interaction.
- **Author it as ability `chainBonus`.** That's per-ability data; the Glove is
  equipment that should buff *any* of the wearer's multi-target spells.
