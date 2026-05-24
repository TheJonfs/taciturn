// Mathematician — the Calculator's Support passive (Session 49). Free
// and native on the Calculator; cross-class costs 2.
//
// Two effects, both Math-Skill-specific:
//
//   1. **+1 SP on Math Skill abilities** via `modifyMathSkillSpBonus`.
//      The dispatcher applies the bonus to the ability's
//      `effects.damage.power_coefficient` before per-target dispatch,
//      so damage / heal / CT-push Math abilities all see the +1.
//      Status-only Math abilities (Sculpted Enhancement, Engineered
//      Defenses) don't have a damage spec, so the bonus has no effect
//      on them — matches the brief's "unaffected" note.
//
//   2. **Per-target MP discount 3 → 1** via
//      `modifyMathSkillPerTargetMpCost`. The Math Skill dispatcher reads
//      the per-target cost through this hook chain; a Mathematician-
//      equipped Calculator pays `mpCost + 1 × matchCount` per cast
//      instead of `mpCost + 3 × matchCount`. Real anti-parasitism
//      lever: a Mage equipping Math Skill as a secondary command set
//      and adding Mathematician sacrifices their Conductor support slot
//      to match Calculator's Math output.
//
// Both hooks fire only when the caster casts a Math Skill ability — the
// dispatcher's call site is the gate; the handlers themselves do not
// inspect the ability beyond passing the running value through.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const MATHEMATICIAN_PER_TARGET_MP_COST = 1;
const MATHEMATICIAN_SP_BONUS = 1;

export const mathematician: PassiveAbilityDefinition = {
  id: abilityId('mathematician'),
  name: 'Mathematician',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyMathSkillPerTargetMpCost', () => MATHEMATICIAN_PER_TARGET_MP_COST),
    passiveHook('modifyMathSkillSpBonus', () => MATHEMATICIAN_SP_BONUS),
  ],
};
