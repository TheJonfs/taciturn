// Counterpunch Strike (Session 76) — the active the Counterpunch reaction
// emits. Instant single-target physical strike at PA × 4, with a PA-scaled
// chance to knock the attacker back 1 tile. Hidden — never a player-pickable
// entry (mirrors Discharge Strike / how Counter re-emits `attack`).
//
// NOT weapon-tagged: the unarmed WP=1 keeps the formula at `PA × 4`, not the
// basic punch's PA² (Barehanded's WP=PA override fires only for `'weapon'`-
// tagged damage). Range 1 melee: a counter against a non-adjacent (ranged /
// repositioned) attacker fizzles at validation — that's how Counterpunch
// stays melee-only.
//
// Knockback (D1 tuning): distance 1, baseChance 20 with `factors: { pa }` →
// at PA 9 that's 20 × (0.9 + 9/10) = ~36% ≈ the brief's "PA × 4 %". A drop
// off a ledge from the shove emits unmitigated falling damage.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const counterpunchStrike: ActiveAbilityDefinition = {
  id: abilityId('counterpunch_strike'),
  name: 'Counterpunch',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'hidden',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 0,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical'],
      power_coefficient: 4,
      variance: { min: 0.9, max: 1.1 },
      knockback: { distance: 1, chance: 20, factors: { pa: true } },
    },
  },
};
