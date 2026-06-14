// Steal MP — Thief Arts. The pressure valve: drains PA × 3 MP from the
// target and restores 50% of the MP *actually removed* to the Thief. Net-
// positive refuel that funds the rest of the kit (and, banked, Steal Heart).
//
// Melee (1h × 3v) and evadable: the `hitRoll` declaration makes the drain
// roll the physical hit/evasion contest (same math as a weapon strike) even
// though it deals no HP — a dodged drain takes nothing. Melee reach is
// deliberate (concept-notes): Move +2 is what lets the Thief cross the field
// to a protected backline caster and drain it.
//
// Restore keys off MP *actually removed*, not the nominal PA × 3 — a near-
// empty target yields a proportionally smaller refuel, and the Thief never
// overflows its own max MP (the transfer-bounded `system_mp_drain` caps both
// ends). mpCost 3 — cheap, so the loop nets positive against a target with MP.
//
// Tuning watch (concept-notes): PA × 3 is 30 MP at max PA, roughly halving a
// rebaselined 48-MP mage on one cast — a max-PA Thief is incidentally a hard
// mage-counter. PA × 2 is the release valve if oppressive.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const stealMp: ActiveAbilityDefinition = {
  id: abilityId('steal_mp'),
  name: 'Steal MP',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 1, vertical: 3 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 3,
  hitRoll: {},
  effects: {
    mpDrain: { coefficient: 3, restorePercent: 50 },
  },
};
