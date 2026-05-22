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
// Range is authored to the bow band (2-5, vertical-infinite, arc) rather
// than weapon-sourced — the weapon-range fork keys on the 'weapon' damage
// tag, and Pin Down deals no damage. Both v1 bows share the 2-5 band, so
// the authored range matches what the Hunter actually fields. mpCost 0:
// the Hunter's bow kit doesn't spend MP, and D2's EV calibration assumes
// Pin Down costs only the action.

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
