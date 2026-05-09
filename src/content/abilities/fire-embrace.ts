// Fire Embrace — Fire Mage's Buff.
//
// Charged ally-target buff with linked PA Up + MA Up rider. Like Fire
// Strike's debuff, the two stat shifts roll as one — both apply or
// neither does. Higher base chance than Fire Strike (80% vs. 60%) since
// the spell does no damage and the application is the entire payoff.
// Permanent for the battle.
//
// Per session 19 plaintext review:
//   - power_coefficient 0 (no damage), mpCost 8, actionSpeed 25 (Buff
//     tier — slightly faster than Strike, parity with Earth Blessing)
//   - PA Up + MA Up on a single 80% Faith × MA roll, magnitude 1
//   - range horizontal 3 / vertical 2, arc — matches Earth Blessing's
//     range
//   - Self-targeting allowed: the BMG target validation accepts caster
//     as target on a `single_unit` ability with no team filter; Fire
//     Mage casting Fire Embrace on themselves is the natural use case
//     for a tempo-burst self-buff
//
// No damage tag — the chance is gated by Faith × MA only; healing tag
// would make it skip resistance per ADR-0016 but Fire Embrace has no
// damage component.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const fireEmbrace: ActiveAbilityDefinition = {
  id: abilityId('fire_embrace'),
  name: 'Fire Embrace',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  tags: ['magical', 'fire'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 3, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 8,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('pa_up'),
        target: 'primary_target',
        baseChance: 80,
        magnitude: 1,
      },
      {
        typeId: statusTypeId('ma_up'),
        target: 'primary_target',
        baseChance: 80,
        magnitude: 1,
        linkRoll: true,
      },
    ],
  },
};
