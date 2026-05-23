// Spark — Fire Mage's Debuff (Burn applier).
//
// Charged single-target. No direct damage. Applies 2 stacks of Burn on
// a single 80% Faith × MA roll — bundled, not independent. Spark is a
// Burn bomb: either both stacks land or neither does. Independent rolls
// would average ~1.6 stacks; bundled is "you get the burst or you
// don't." Tactical use: open a fight by lighting a target on fire,
// then walk away while the burn ticks itself out.
//
// Per session 19 plaintext review:
//   - power_coefficient 0 (no direct damage), mpCost 10, actionSpeed 28
//     (mid-tier charge; faster than Fire Strike's 30 since no direct
//     damage component to balance against)
//   - 2 stacks of Burn on a single 80% roll (`stackQuantity: 2`)
//   - range horizontal 4 / vertical 2, arc
//
// At Fire Mage MA 9: Burn coefficient 0.6 → 5 dmg per stack. Spark
// applies 2 stacks worth of value: 10 dmg over the next CT-100 trigger,
// then 5 dmg the trigger after — 15 total damage from the application,
// distributed over two of the target's upcoming turns. Compares
// favorably with a 5-power direct cast (~17 damage at MA 9 against a
// no-resistance target) but trades the front-loaded payoff for tempo
// pressure (the target sees two CT-100 ticks worth of damage even if
// Fire Mage walks away or focuses elsewhere).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const spark: ActiveAbilityDefinition = {
  id: abilityId('spark'),
  // S40 name-update pass: display name 'Slow Burn'; id preserved.
  name: 'Slow Burn',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'fire'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 28,
  mpCost: 10,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        baseChance: 80,
        stackQuantity: 2,
      },
    ],
  },
};
