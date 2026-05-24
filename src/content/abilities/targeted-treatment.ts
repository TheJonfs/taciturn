// Targeted Treatment — Math Skill #2 (Session 49 / ADR-0086).
//
// The Calculator's multi-target heal. SP 4 base (5 with Mathematician);
// heal per matching target = `SP × MA × Faith Factor`. Tagged `healing`
// + `magical` so the standard pipeline flips damage to heal at the
// resistance stage (per ADR-0016: healing-tagged effects bypass
// resistance modulation; cap stage clamps to maxHp).
//
// Note: friendly fire applies — a matching enemy receives healing too.
// The AI scoring layer disprefers this (heal to enemies is negative
// value); a human Calculator must read the preview before committing.
// Per the brief's "interesting trade-off" intent.
//
// Targeting: math_skill. Base MP cost 4 + per-target.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const targetedTreatment: ActiveAbilityDefinition = {
  id: abilityId('targeted_treatment'),
  name: 'Targeted Treatment',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: { kind: 'math_skill' },
  actionSpeed: 0,
  mpCost: 4,
  mathSkillMpCost: { perTarget: 3 },
  tags: ['math_skill', 'healing'],
  effects: {
    damage: {
      // 'healing' tag flips the damage pipeline to heal-mode (per
      // ADR-0016). 'magical' tag routes through the magical_ma_power
      // base handler so MA × power × Faith composes naturally.
      tags: ['magical', 'healing'],
      power_coefficient: 4,
    },
  },
};
