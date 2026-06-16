// wand_of_potential_apply_shift — Session 68. Hidden single-target
// shift application fired by the Wand of Potential's `attackProcs`.
//
// Applies `{ water: +25, earth: -25 }` to the struck target via the
// parametric `tagged_resistance_shift` status (the Session 31 wand-
// resonance substrate). This completes the four-element wand rotation:
// the prior three wands cover the fire/lightning axis (Depths +fire
// /-lightning, Deepwood +lightning/-fire) and one half of the
// earth/water axis (Lumen +earth/-water); the Wand of Potential closes
// it with the reversed earth/water shift (+water/-earth). Net-neutral
// total resistance, like the rest of the family.
//
// Note: the Resonance is water/earth disruption, NOT lightning-specific
// — the wand's lightning support lives entirely in its `spellPowerModifiers`
// rider (+1 SP on the holder's lightning magic). The two effects are
// independent (per the S68 design call).
//
// Flat-chance proc per the equipment doc; the weapon's
// `attackProcs[].chance` gates, and once landed the application is
// unconditional (`applyAlways: true`).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const wandOfPotentialApplyShift: ActiveAbilityDefinition = {
  id: abilityId('wand_of_potential_apply_shift'),
  name: 'Wand of Potential Resonance',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['water'],
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
          tagDeltas: { water: 25, earth: -25 },
          displayName: 'Wand of Potential Resonance',
        },
      },
    ],
  },
};
