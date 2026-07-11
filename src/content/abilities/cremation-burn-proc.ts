// Cremation's Burn rider — hidden proc ability fired by the Cremation
// axe's guaranteed on-hit (TABA Ch3 unique).
//
// apply_burn_proc's shape (Flametongue, ADR-0064) with ONE difference:
// `stackQuantity: 2` — every landed swing plants two Burn stacks
// (Spark/"Slow Burn" precedent for the two-stack application; both
// stacks ride one roll, and `applyAlways` means the roll only bends to
// the target's modifier hooks — Focus Band ×0.75 etc.). Each stack
// snapshots the WIELDER's MA at floor(MA × 0.6)/tick, so a Cremation
// Knight plants weak-but-real embers while a hybrid wielder gets a
// genuine DoT engine.
//
// Watch-for (brief, don't pre-nerf): 2 guaranteed stacks × Pendant of
// Lumara (tick ×2) is a high DoT ceiling.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const cremationBurnProc: ActiveAbilityDefinition = {
  id: abilityId('cremation_burn_proc'),
  name: 'Burn',
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
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        applyAlways: true,
        stackQuantity: 2,
      },
    ],
  },
};
