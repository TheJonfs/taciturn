// Steal MP — Thief Arts. The pressure valve: drains PA × 3 MP from the
// target and restores 50% of the MP *actually removed* to the Thief. Net-
// positive refuel that funds the rest of the kit (and, banked, Steal Heart).
//
// Weapon-delivered (the `'weapon'` ability tag): the drain inherits the
// equipped weapon's reach like a basic Attack / Steal HP — a melee weapon
// keeps the authored 1h × 3v, a bow extends it to 2-5 (Chris's call). Evadable:
// the `hitRoll` declaration makes the drain roll the physical hit/evasion
// contest (same math as a weapon strike) even though it deals no HP — a dodged
// drain takes nothing. For a melee-weapon Thief, Move +2 is the reach that
// closes on a protected backline caster (concept-notes); a bow Thief drains
// from range instead.
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
  // `'weapon'` ability tag (no damage effect to carry it) — marks Steal MP as
  // weapon-delivered so it inherits the equipped weapon's range like a basic
  // Attack / Steal HP (Chris: a bow Thief drains MP at range). The authored
  // melee 1 is the unarmed / melee-weapon default; a bow overrides it to 2-5.
  tags: ['weapon'],
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
