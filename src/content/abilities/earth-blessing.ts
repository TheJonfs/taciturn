// Earth's Blessing — Earth Mage's Buff.
//
// Charged single-target ally Regen application. The Regen status
// itself heals MaxHP-scaled amounts on the recipient's CT cadence
// (see content/statuses/regen.ts).
//
// Per session 16 plaintext review:
//   - mpCost 6, actionSpeed 30 (faster than Strike — buffs come online quicker)
//   - status baseChance 100% (still rolls Faith × resistance, but the
//     ability author intends this to land barring resistance)
//   - duration 36 — about 4-5 ticks at base Speed 7
//   - range horizontal 4 / vertical 2, arc (parity with Strike)
//
// Tactical comparison vs. Cure (white_magic command set's burst heal):
// Earth's Blessing is slower (charged) and gradual (over time) but
// scales harder per MP at full duration on a high-MaxHP target.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const earthBlessing: ActiveAbilityDefinition = {
  id: abilityId('earth_blessing'),
  // S40 name-update pass: display name 'Life from the Loam'; id preserved.
  name: 'Life from the Loam',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'earth'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 30,
  mpCost: 6,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('regen'),
        target: 'primary_target',
        baseChance: 100,
        duration: 10,
      },
    ],
  },
};
