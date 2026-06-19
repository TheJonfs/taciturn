// Exact Rhythm — Math Skill #3 (Session 49 / ADR-0086).
//
// The Calculator's multi-target CT push. SP 2 base (3 with Mathematician);
// per matching target the unit's CT is reduced by `SP × MA` (clamped at
// unit.ct = 0 by the reducer).
//
// S71 (#15 Math Skill Faith sweep): Faith removed from the magnitude.
// Math Skill is a deterministic instrument — the Calculator's identity is
// faith-independent output (the ~2× that justifies its lower MA). Precision
// Fire and Targeted Treatment dropped Faith from their magnitudes in S63;
// Exact Rhythm was the leftover blueprint-era exception (it still read
// `SP × MA × Faith Factor`). This aligns it with the other two — a ~2×
// magnitude lift at default Faith, same shape as the S63 buff.
//
// Tactical watch (per blueprint): multi-target CT push every Calculator
// turn could lock out enemies. Chris will stress-test post-implementation;
// if snowballing emerges, levers are SP reduction or per-cast cooldown.
//
// Targeting: math_skill. Friendly fire applies — a matching ally's CT
// also pushes back. The AI scoring layer accounts for this (CT push on
// allies is negative value).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const exactRhythm: ActiveAbilityDefinition = {
  id: abilityId('exact_rhythm'),
  name: 'Exact Rhythm',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: { kind: 'math_skill' },
  actionSpeed: 0,
  mpCost: 4,
  mathSkillMpCost: { perTarget: 3 },
  tags: ['math_skill'],
  effects: {
    ctEffects: [
      {
        target: 'primary_target',
        // Negative factor pushes the target's CT backward; magnitude is
        // `factor × MA` (Faith-independent per #15). Mathematician's +1 SP
        // bonus increases |factor| from 2 to 3 (Math Skill SP bonus is
        // applied in the direction of the factor — see `applyMathSkillSpBonus`).
        factor: -2,
        stat: 'ma',
        // Deterministic application and magnitude (no baseChance, no Faith
        // term) — Math Skill reads as a precise instrument. CT clamp at 0
        // happens in `reduceSystemCtPush`.
      },
    ],
  },
};
