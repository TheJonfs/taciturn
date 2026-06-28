// Barehanded — the Monk's signature Support passive (Session 76).
//
// While the unit holds nothing in either hand, its effective Weapon
// Power becomes PA instead of the unarmed default of 1. The basic Attack
// (the punch) is `PA × WP × coefficient`; with WP=PA that resolves to
// `PA² × coefficient` — the Monk's "sellout" damage, melee-committal and
// uncapped by design.
//
// Mechanism: registers `modifyWeaponPower`, the chain `physicalPaWp` runs
// for `'weapon'`-tagged damage only. The Monk's four Fists deal element-
// tagged physical damage WITHOUT the `'weapon'` tag, so they never run
// this chain — they stay at the unarmed WP=1 baseline (`PA × coefficient`)
// and can't PA²-explode. That tag split is the whole balance lever: the
// only way to access the quadratic is the stance-less, rider-less punch.
//
// `args.pa` is the attacker's already-modified PA (post-`modifyStatQuery`),
// so PA buffs (Gauntlet, Martial Expertise, Combat Focus) compound into
// the override naturally — expected and uncapped per the S76 brief.
//
// baseCost 1 (cross-class): a non-Monk that strips both weapons can equip
// this to punch for PA². Free for the Monk (`freeAbilities`). The
// both-hands-empty gate means it's inert the moment a weapon is held.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const barehanded: PassiveAbilityDefinition = {
  id: abilityId('barehanded'),
  name: 'Barehanded',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyWeaponPower', (args) => {
      const { leftHand, rightHand } = args.unit.equipment;
      if (leftHand === null && rightHand === null) return args.pa;
      return args.baseValue;
    }),
  ],
};
