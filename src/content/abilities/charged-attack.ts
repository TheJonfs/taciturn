// Charged Attack — Hunter Marksmanship command (Session 45). The aimed
// shot: a charged physical bow attack that lands extra damage when the
// target is still on the pinned tile at resolution.
//
// `actionSpeed: 25` (the Brine / Earth Quake debuff tier — comes online
// in ~1 enemy turn for a Speed-9 Hunter; the calibration lever per D4).
// Because the charge mechanism is flavor-agnostic (`actionSpeed > 0` is
// the only gate, no magic check), a physical bow attack charges exactly
// like a spell.
//
// S48 tuning: `power_coefficient: 2.0` and `mpCost: 6` — the charge
// delay deserves an outsized payoff. Pre-S48 Charged Attack and Power
// Attack both landed at 1.5× coefficient, trading mpCost 0 + delay vs.
// mpCost 6 + instant. Two trades on the same axis collapsed the choice;
// the new shape (2.0× + 6 MP) makes Charged Attack the higher-ceiling
// option — the player pays both the wait and the MP, but the hit at the
// end of the queue is a bona fide hammer.
//
// Tags ['physical', 'weapon'] make it weapon-sourced across the board:
// the equipped bow supplies WP, accuracy (`hitRoll: {}` → weapon
// accuracy), the height-delta variance band, AND — via the weapon-range
// fork — the 2-5 range. Pure `tile` arc targeting (S74): the aimed shot
// commits to a *tile*, not a unit. At resolution it hits whoever stands on
// that tile — and nothing if the target has moved off it. This is the
// deliberate positional gamble that distinguishes Charged Attack from the
// charged spells (which are `unit_or_tile` and track their unit by id). It
// is NOT `unit_or_tile`: there is no pin-the-unit-and-track option, so the
// AI can't claim a free guaranteed hit by following a displaced target.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const chargedAttack: ActiveAbilityDefinition = {
  id: abilityId('charged_attack'),
  name: 'Charged Attack',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['physical', 'weapon'],
  targeting: {
    // Fallback band (no bow equipped); the weapon-range fork overrides
    // to the equipped bow's range for this weapon-tagged attack.
    kind: 'tile',
    range: { horizontal: 5, minHorizontal: 2, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 6,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 2.0,
    },
  },
};
