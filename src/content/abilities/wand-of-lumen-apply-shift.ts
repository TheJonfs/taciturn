// wand_of_lumen_apply_shift — Session 45 follow-up. Hidden single-target
// resistance-shift application fired by the Wand of Lumen's `attackProcs`.
//
// Mirrors `wand_of_depths_apply_shift` / `wand_of_deepwood_apply_shift`
// in shape: 100% chance per physical hit, applies a
// `tagged_resistance_shift` with per-instance deltas authored on
// `customState`. The Lumen rotates the wand-shift coverage to the other
// elemental axis — `+25 Earth / -25 Water` (per plan-review). Stacks
// additively with repeat applications; persists battle-long.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const wandOfLumenApplyShift: ActiveAbilityDefinition = {
  id: abilityId('wand_of_lumen_apply_shift'),
  name: 'Wand of Lumen Resonance',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  tags: ['fire'],
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
          tagDeltas: { earth: 25, water: -25 },
          displayName: 'Wand of Lumen Resonance',
        },
      },
    ],
  },
};
