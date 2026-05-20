// Power Attack — Knight Battle Skill heavy strike. Same range and
// pipeline as basic Attack, with a higher power coefficient (1.5 vs
// 1.0) traded for an MP cost. The first ability to exercise the
// coefficient lever introduced by ADR-0028's WP refactor — where Attack
// reads "PA × WP × 1.0", Power Attack reads "PA × WP × 1.5". The
// coefficient is purely the ability-side factor; weapon upgrades scale
// Power Attack alongside basic Attack.
//
// Numbers per session 17c plaintext review, mpCost bump from S41
// (Battle Skill scaled up to gate uses more meaningfully):
//   - power_coefficient 1.5: ~50% damage uplift over basic Attack.
//   - mpCost 6 (S41 +2 from 4): Knight at base 20 MP can Power Attack
//     3 times before MP is dry.
//   - Same range / variance / hitRoll as basic Attack — only the
//     coefficient and cost differ.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const powerAttack: ActiveAbilityDefinition = {
  id: abilityId('power_attack'),
  name: 'Power Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 6,
  hitRoll: {},
  // Multi-weapon eligible (Session 42, D1b): a damage Battle Skill, so a
  // Two-Weapons wielder swings both weapons (doubling damage is
  // consistent with the basic-Attack rule). Inert without dual-wield.
  multiWeapon: true,
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.5,
      variance: { min: 0.9, max: 1.1 },
    },
  },
};
