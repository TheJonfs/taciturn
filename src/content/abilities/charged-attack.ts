// Charged Attack — Hunter Marksmanship command (Session 45). The aimed
// shot: a charged physical bow attack that lands extra damage when the
// target is still on the pinned tile at resolution.
//
// `actionSpeed: 25` (the Brine / Earth Quake debuff tier — comes online
// in ~1 enemy turn for a Speed-9 Hunter; the calibration lever per D4).
// Because the charge mechanism is flavor-agnostic (`actionSpeed > 0` is
// the only gate, no magic check), a physical bow attack charges exactly
// like a spell. `power_coefficient: 1.5` is the extra-damage multiplier
// over the basic shot.
//
// Tags ['physical', 'weapon'] make it weapon-sourced across the board:
// the equipped bow supplies WP, accuracy (`hitRoll: {}` → weapon
// accuracy), the height-delta variance band, AND — via the weapon-range
// fork — the 2-5 range. `unit_or_tile` arc targeting is the FFT
// pin-a-tile-or-unit charged pattern: pin a tile and the shot hits
// whoever stands there at resolution (nothing if they've moved off).
// mpCost 0 — bow attacks don't spend MP.

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
    kind: 'unit_or_tile',
    range: { horizontal: 5, minHorizontal: 2, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 0,
  hitRoll: {},
  effects: {
    damage: {
      tags: ['physical', 'weapon'],
      power_coefficient: 1.5,
    },
  },
};
