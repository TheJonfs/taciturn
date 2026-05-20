// Stasis Sword — Knight Battle Skill that strikes for normal weapon
// damage and, on hit, has a chance to inflict Stop on the target. The
// first content consumer of ADR-0028's customizable status formula:
// the Stop application uses a Brave-and-MA factor mix instead of the
// default Faith-and-MA (Knights are higher Brave than Faith, so Brave
// best fits a hybrid martial build).
//
// Numbers per session 17c plaintext review, mpCost bump from S41
// (Battle Skill scaled up to gate uses more meaningfully):
//   - power_coefficient 1.0: same damage as basic Attack — the
//     ability's value is the rider, not the damage.
//   - mpCost 8 (S41 +2 from 6): Knight at base 20 MP can Stasis Sword
//     twice. Tighter gating on a high-tempo control rider.
//   - Stop baseChance 50, factors `{ brave: true, ma: true }`. At the
//     v1 placement default Brave 70 / MA 4 (Knight baseline), the rate
//     is roughly 0.5 × 1.0 × (0.7 + 4/10) = 0.5 × 1.1 = 0.55. A Knight
//     running Bravestrider (Brave +10 → 80) pushes the rate to
//     0.5 × 1.2 = 0.60. Earth Mage teammates running Biomastery
//     (× 1.25) amplify from there.
//   - Stop duration: short but tactical.

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
  mpCost: 8,
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
        duration: 3,
        factors: { brave: true, ma: true },
      },
    ],
  },
};
