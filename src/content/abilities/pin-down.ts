// Pin Down — Hunter Marksmanship command (Session 45). Instant, ranged,
// no-damage: pins a target with Slow.
//
// Brave-and-Speed formula (the Assassin Shadow Arts shape, ADR-0081):
//   chance = baseFraction × (caster_brave/100) × (target_brave/100)
//                         × (0.9 + caster_speed/20)
// declared `factors: { brave: true, speed: true }`. baseChance 50 (per
// S45 D2 — at Hunter Speed 9 / Brave 70 vs Brave 70 this nets ~33%, an
// action-cost-only debuff that clears break-even); Slow for 4 turns
// (D3). No `hitRoll` and no `damage`, so the status formula alone decides
// the outcome and no damage-triggered reactions fire.
//
// Weapon-sourced range (the `'weapon'` ability tag): Pin Down deals no
// damage to carry a `'weapon'` damage tag, so it declares the tag at the
// ability level — the same path the Thief's Steal MP uses — to make the
// weapon-range fork (and the bow's range-from-height bonus) apply. With a bow
// equipped the reach derives from the weapon (so it tracks the actual bow and
// gains extended horizontal range when shooting from high ground); the
// authored 2-5 band is the no-bow fallback (matching Charged Attack's shape).
// mpCost 0: the Hunter's bow kit doesn't spend MP, and D2's EV calibration
// assumes Pin Down costs only the action.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const pinDown: ActiveAbilityDefinition = {
  id: abilityId('pin_down'),
  name: 'Pin Down',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['weapon'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 5, minHorizontal: 2, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 0,
  mpCost: 0,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('slow'),
        target: 'primary_target',
        baseChance: 50,
        duration: 4,
        factors: { brave: true, speed: true },
      },
    ],
  },
};
