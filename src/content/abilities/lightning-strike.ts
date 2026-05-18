// Lightning Strike — Lightning Mage's Base spell.
//
// Charged single-target magical lightning damage. No rider — just raw
// damage. Per Chris's session 20 plaintext call: Lightning's identity
// in this version is "elevated raw spell power" rather than secondary
// effects, so power_coefficient is 12 (substantially above the
// Strike-tier baseline of ~5 across Earth/Water/Fire); broader cross-
// element tuning is a post-session-20 pass.
//
// Per session 20 plaintext review:
//   - power_coefficient 12, mpCost 10, actionSpeed 30 (matches the
//     Strike tier across Earth/Water/Fire bread-and-butter casts)
//   - range horizontal 4 / vertical 2, arc — parity with Fire Strike
//
// Crit interaction: Lightning Strike is the natural payload for the
// kit's Static Embrace + Magnetic Mark setup — a crit through Vulnerable
// is ×1.5 × ×1.5 = ×2.25 effective on top of an already-premium power
// coefficient.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const lightningStrike: ActiveAbilityDefinition = {
  id: abilityId('lightning_strike'),
  // S40 name-update pass: display name 'Lightning Bolt'; id preserved.
  name: 'Lightning Bolt',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 10,
  effects: {
    damage: {
      tags: ['magical', 'lightning'],
      power_coefficient: 12,
    },
  },
};
