// wand_of_depths_apply_shift — Session 31. Hidden single-target shift
// application fired by Wand of the Depths' `attackProcs`.
//
// Per the equipment doc: Wand of the Depths' on-hit effect applies +25
// Fire / -25 Lightning to the target, persists for the battle, stacks
// across multiple applications. Implemented via the `tagged_resistance_shift`
// status (Session 31 substrate). The status type is parametric — the
// applying ability authors the per-instance tagDeltas + displayName on
// `StatusEffectSpec.customState`, and the status's `modifyResistance`
// handler reads from there.
//
// Flat-chance proc per the equipment doc's "Weapon-applied status procs
// use flat percentages" rule. The weapon's `attackProcs[].chance` is
// the gate; once the proc lands, the application is unconditional
// (`applyAlways: true`).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const wandOfDepthsApplyShift: ActiveAbilityDefinition = {
  id: abilityId('wand_of_depths_apply_shift'),
  name: 'Wand of the Depths Resonance',
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
          tagDeltas: { fire: 25, lightning: -25 },
          displayName: 'Wand of the Depths Resonance',
        },
      },
    ],
  },
};
