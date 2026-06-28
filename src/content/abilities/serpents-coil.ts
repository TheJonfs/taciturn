// Serpent's Coil (Session 76) — water-tagged Fist with tempo. Deals
// PA × coefficient physical damage tagged Water, refunds Speed × 2 CT to the
// caster on a landed hit (the next turn comes sooner), and sets Serpent Stance
// (+50 Water / −50 Fire).
//
// The CT refund is the rider (`selfCtRefund` — deterministic on hit, not
// chance-gated): Serpent's Coil is the tempo Fist, letting a committed Monk
// chain blows. NOT weapon-tagged, so the strike is `PA × power_coefficient`,
// not the PA² punch.
//
// Physical (hitRoll present); a miss refunds no CT. Instant (actionSpeed 0).
// Stance management runs pre-resolve in `reduceUseAbility`.
//
// (D4 tuning: factor 2 on Speed ≈ +20 CT at the Monk's Speed 10 — watch that
// it doesn't form a dominant tempo loop; tune down if it spams.)

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const serpentsCoil: ActiveAbilityDefinition = {
  id: abilityId('serpents_coil'),
  name: "Serpent's Coil",
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['water'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 4,
  hitRoll: {},
  effects: {
    clearCasterExclusivityGroup: 'stance',
    setStance: statusTypeId('serpent_stance'),
    damage: {
      // S76 tune: 3 → 5 → 7. Competitive with the punch (the Fists cost MP, the
      // punch is free) while a notch below Foxfire — Serpent's Coil's upside is
      // the Speed×2 CT refund (strong tempo). ~78% of the punch at PA 9.
      tags: ['physical', 'water'],
      power_coefficient: 7,
      variance: { min: 0.9, max: 1.1 },
    },
    selfCtRefund: { factor: 2, stat: 'spd' },
  },
};
