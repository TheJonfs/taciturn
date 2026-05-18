// Fire Strike — Fire Mage's Base spell.
//
// Charged single-target magical fire damage with linked PA Down + MA
// Down rider. Per session 19 plaintext review: a single roll either
// applies *both* debuffs or *neither* (linked, all-or-nothing) via the
// `linkRoll` field on the second status spec. This gives Fire's stat
// manipulation a different texture from Earth's independent dual rolls
// (Earth Curse) — Fire is decisive: high reward when it lands, nothing
// when it misses.
//
// Per session 19 plaintext review:
//   - power_coefficient 5, mpCost 10, actionSpeed 30 (matches the
//     Strike tier across Earth/Water/Fire bread-and-butter casts)
//   - PA Down + MA Down on a single 60% Faith × MA roll, magnitude 1,
//     permanent for the battle (no expiration)
//   - range horizontal 4 / vertical 2, arc
//
// Linked-roll mechanics: the resolver shares the previous effect's
// `effectIndex` so `rollStatusChance` produces the same `roll` value;
// since both effects also have identical chance computation (same
// baseChance, same factors, same resistance tag against the same
// target), the `applied` outcome is identical too. Net result: both
// stat shifts apply or neither does.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const fireStrike: ActiveAbilityDefinition = {
  id: abilityId('fire_strike'),
  // S40 name-update pass: display name 'Scorch'; id preserved.
  name: 'Scorch',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'fire'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 10,
  effects: {
    damage: {
      tags: ['magical', 'fire'],
      power_coefficient: 8,
    },
    statusEffects: [
      {
        typeId: statusTypeId('pa_down'),
        target: 'primary_target',
        baseChance: 60,
        magnitude: 1,
      },
      {
        typeId: statusTypeId('ma_down'),
        target: 'primary_target',
        baseChance: 60,
        magnitude: 1,
        linkRoll: true, // applies iff the PA Down roll applied
      },
    ],
  },
};
