// Earth Curse — Earth Mage's Debuff.
//
// Charged single-target debuff that applies Blind + Silence to the
// target. Each rolls independently — landing only Blind, only
// Silence, both, or neither are all possible per cast (per session 16
// plaintext review). The independence comes from the per-effect seed
// branching in `resolveAbilityEffect`.
//
// Per session 16 plaintext review:
//   - mpCost 8 (highest of the 3 Earth actives — high-impact debuff)
//   - actionSpeed 30
//   - Blind / Silence baseChance 50% each (symmetric)
//   - duration 24 each (standard debuff length per BMG)
//   - range horizontal 4 / vertical 2, arc (parity with Strike)
//
// Earth Communion's × 1.25 modifier applies to *each* status's roll
// independently — the status_modifiers term in the BMG formula
// composes multiplicatively into the per-effect chance.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const earthCurse: ActiveAbilityDefinition = {
  id: abilityId('earth_curse'),
  name: 'Earth Curse',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'earth'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('blind'),
        target: 'primary_target',
        baseChance: 50,
        duration: 4,
      },
      {
        typeId: statusTypeId('silence'),
        target: 'primary_target',
        baseChance: 50,
        duration: 4,
      },
    ],
  },
};
