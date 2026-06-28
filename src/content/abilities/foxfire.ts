// Foxfire (Session 76) — fire-tagged Fist. Deals PA × coefficient physical
// damage with a Fire tag (reduced by the target's Fire resistance; absorbed
// if they resist > 100), with a 50% chance to apply 1 stack of Burn, and sets
// Fox Stance (+50 Fire / −50 Earth) on the caster.
//
// NOT weapon-tagged: the damage formula reads the unarmed WP=1, so it lands
// at `PA × power_coefficient` — Barehanded's WP=PA override fires only for the
// `'weapon'`-tagged basic punch, so a Fist can't PA²-explode (the central S76
// balance lever). The element tag rides through the resistance step.
//
// Burn lands via the PA + Brave path (`factors: { brave, pa }`), NOT the
// default Faith × MA — the Monk dumps MA, so the standard gate would rarely
// land. The Burn's per-tick DAMAGE still snapshots the applier's MA (weak for
// the Monk); the rider is chip pressure, not the Fist's point. (D3 tuning:
// base 50%.)
//
// Instant melee (actionSpeed 0, range 1). Stance management (clear group →
// set Fox) runs pre-resolve in `reduceUseAbility`.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const foxfire: ActiveAbilityDefinition = {
  id: abilityId('foxfire'),
  name: 'Foxfire',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['fire'],
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
    setStance: statusTypeId('fox_stance'),
    damage: {
      // S76 tune: 3 → 6. The Fists were only ~⅓ of the PA² punch; bumped so a
      // Fist is a live choice (damage + stance + rider) vs sellout-punching.
      // Foxfire gets the highest direct damage of the Fists because its Burn
      // rider is weak (ticks off the Monk's dumped MA 4).
      tags: ['physical', 'fire'],
      power_coefficient: 6,
      variance: { min: 0.9, max: 1.1 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('burn'),
        target: 'primary_target',
        baseChance: 50,
        factors: { brave: true, pa: true },
        stackQuantity: 1,
      },
    ],
  },
};
