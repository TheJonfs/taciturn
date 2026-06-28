// Chakra (Session 76) — the Monk's self-sustain. Heals HP AND restores MP
// for the caster and every unit in a 1-diamond around them, scaling off the
// PA monostat (not MA — the Monk dumps MA). Never crits, no Faith scaling.
//
// Clears the caster's stance to neutral on cast (`clearCasterExclusivityGroup:
// 'stance'`, handled pre-resolve in `reduceUseAbility`) — the heal-but-expose-
// yourself tradeoff: the turn you mend, your elemental resistance drops to its
// thin baseline.
//
// Friendly fire is the v1 AoE model (the Cure-style spatial downside): the
// diamond heals every unit in the footprint, enemies included — don't Chakra
// next to a wounded foe. `excludeCaster: false` keeps the caster in it.
//
// Instant (actionSpeed 0) and mpCost 0 — the Monk is a melee class, not a
// caster, and the action economy (one Act per turn) is the real gate on
// sustain: a turn spent on Chakra is a turn not spent punching.
//
// Tuning (D2): heal coefficient 4 (PA 9 → ~36 HP) and MP coefficient 2
// (PA 9 → ~18 MP) are starting values for the sim seam + hand-play.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const chakra: ActiveAbilityDefinition = {
  id: abilityId('chakra'),
  name: 'Chakra',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: { kind: 'self' },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    clearCasterExclusivityGroup: 'stance',
    damage: {
      tags: ['healing'],
      power_coefficient: 4,
      healingStat: 'pa',
      noFaithScaling: true,
    },
    mpRestore: {
      power_coefficient: 2,
      stat: 'pa',
    },
    aoe: {
      excludeCaster: false,
      shape: { kind: 'diamond', radius: 1 },
      verticalTolerance: 1,
    },
  },
};
