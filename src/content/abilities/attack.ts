// Attack — the basic melee strike that lives in Knight's Battle Skill.
// Session 5 carried the slot/cost shape; session 7 added the targeting,
// charge, MP, and damage declaration. Session 8 wired it through the
// damage pipeline: 'physical' tag triggers the PA × WP × power_coefficient
// formula at the base stage. Session 14 declared `hitRoll: {}` so the
// evasion_check pipeline handler runs (per ADR-0019).
//
// Session 17c (per ADR-0028) split the previous `power: 4` placeholder
// into the real two factors: `power_coefficient: 1.0` (this ability's
// share) × WP=4 (sourced from the equipped Long Sword). The product
// stays at 4, so v1 damage numbers are preserved while the model now
// reflects the BMG-faithful `PA × WP × coefficient` shape. Power
// Attack and other Battle Skill abilities pick coefficients > 1.0 to
// scale relative to the basic strike.
//
// `accuracy` is no longer per-ability — `evasionCheck` reads the
// equipped weapon's accuracy. Knight's Long Sword carries 95; against
// today's zero-evasion classes the [0.05, 1.0] clamp lands at 0.95,
// so attacks miss occasionally. Per-ability `hitRoll.accuracy`
// override stays available for content that wants to depart from
// weapon accuracy (none in v1).

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const attack: ActiveAbilityDefinition = {
  id: abilityId('attack'),
  name: 'Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
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
      tags: ['physical', 'weapon'],
      power_coefficient: 1.0,
      variance: { min: 0.9, max: 1.1 },
    },
  },
};
