// Power Attack — Knight Battle Skill heavy strike. Same range and
// pipeline as basic Attack, with a higher power coefficient (1.5 vs
// 1.0) traded for an MP cost (4 vs 0). The first ability to exercise
// the new coefficient lever introduced by ADR-0028's WP refactor —
// where Attack reads "PA × WP × 1.0", Power Attack reads "PA × WP ×
// 1.5". The coefficient is purely the ability-side factor; weapon
// upgrades scale Power Attack alongside basic Attack.
//
// Numbers per session 17c plaintext review:
//   - power_coefficient 1.5: ~50% damage uplift over basic Attack.
//   - mpCost 4: a Knight at base 10 MP can Power Attack twice.
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
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 4,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.5,
      variance: { min: 0.9, max: 1.1 },
    },
  },
};
