// Earth Strike — Earth Mage's Base spell.
//
// Charged single-target magical damage with a Movement Debuff rider.
// The first content consumer of "charged + status rider" — exercises
// the resolve reducer's `resolveAbilityEffect` per-target body for
// status application on charged spells (per session 15 → 16 handoff).
//
// Per session 16 plaintext review:
//   - power 6, mpCost 4, actionSpeed 25 (fast tier)
//   - debuff baseChance 60%, duration 36
//   - range horizontal 4 / vertical 2, arc
//
// Why charged: Earth's identity is "the slow, weighty force" — even
// the bread-and-butter cast takes a moment. Charge time is the price
// for ranged magical damage at parity with melee physical damage; as
// classes acquire MA-amplifying equipment / passives, the same cast
// will scale further than melee can without weapon upgrades.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const earthStrike: ActiveAbilityDefinition = {
  id: abilityId('earth_strike'),
  name: 'Earth Strike',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  tags: ['magical', 'earth'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 4,
  effects: {
    damage: {
      tags: ['magical', 'earth'],
      power: 6,
    },
    statusEffects: [
      {
        typeId: statusTypeId('movement_debuff'),
        target: 'primary_target',
        baseChance: 60,
        duration: 36,
      },
    ],
  },
};
