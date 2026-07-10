// apply_scoured_proc — TABA M3 (Scouring Wand). Hidden single-target
// Scoured application fired by the wand's 100% attackProcs rider on
// every landed physical hit.
//
// Mirrors apply_burn_proc: the wand-side chance is the gate (here 100%
// — every poke shreds), `applyAlways` lands the stack unconditionally.
// Scoured itself is the STACK_ADDITIVE accumulator (−33 all-element res
// per stack, unbounded by ruling).

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const applyScouredProc: ActiveAbilityDefinition = {
  id: abilityId('apply_scoured_proc'),
  name: 'Scour',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
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
        typeId: statusTypeId('scoured'),
        target: 'primary_target',
        applyAlways: true,
      },
    ],
  },
};
