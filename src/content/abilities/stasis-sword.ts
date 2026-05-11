// Stasis Sword — Knight Battle Skill that strikes for normal weapon
// damage and, on hit, has a chance to inflict Stop on the target. The
// first content consumer of ADR-0028's customizable status formula:
// the Stop application uses a Brave-and-MA factor mix instead of the
// default Faith-and-MA (Knights are higher Brave than Faith, so Brave
// best fits a hybrid martial build).
//
// Numbers per session 17c plaintext review:
//   - power_coefficient 1.0: same damage as basic Attack — the
//     ability's value is the rider, not the damage.
//   - mpCost 6: gates use vs. basic Attack.
//   - Stop baseChance 50, factors `{ brave: true, ma: true }` — at
//     Brave 100 / MA 4 (Knight default), the effective rate is
//     0.5 × 1.0 × (0.9 + 4/10) = 0.5 × 1.3 = 0.65, i.e., ~65% before
//     Earth Communion modifiers and target resistance. Earth Mage
//     teammates running Earth Communion (× 1.25) push it to ~81%.
//   - Stop duration 12 ticks — short but tactical.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stasisSword: ActiveAbilityDefinition = {
  id: abilityId('stasis_sword'),
  name: 'Stasis Sword',
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
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.0,
      variance: { min: 0.9, max: 1.1 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('stop'),
        target: 'primary_target',
        baseChance: 50,
        duration: 12,
        factors: { brave: true, ma: true },
      },
    ],
  },
};
