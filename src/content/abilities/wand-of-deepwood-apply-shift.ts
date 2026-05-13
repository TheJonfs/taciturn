// wand_of_deepwood_apply_shift — Session 31. Hidden single-target shift
// application fired by Wand of the Deepwood's `attackProcs`.
//
// Sibling of `wand_of_depths_apply_shift`. The deltas are inverted —
// +25 Lightning / -25 Fire — so that Wand of the Depths and Wand of
// the Deepwood applied to the same target compose to zero net through
// `runModifyResistance`'s additive chain. See Session 31 substrate
// tests for the cross-wand cancellation case.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const wandOfDeepwoodApplyShift: ActiveAbilityDefinition = {
  id: abilityId('wand_of_deepwood_apply_shift'),
  name: 'Wand of the Deepwood Resonance',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['earth'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 1 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('tagged_resistance_shift'),
        target: 'primary_target',
        applyAlways: true,
        customState: {
          tagDeltas: { lightning: 25, fire: -25 },
          displayName: 'Wand of the Deepwood Resonance',
        },
      },
    ],
  },
};
