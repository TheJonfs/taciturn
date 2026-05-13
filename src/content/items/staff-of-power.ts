// Staff of Power — quality-over-quantity magical generalist weapon.
// WP 4, accuracy 80.
//
// Per the equipment doc: +MA paired with × 1.20 MP cost on all spells.
// Meaningful damage boost in exchange for ~17% fewer total casts per
// battle (proportional to MP budget).
//
// Session 31.5: +MA bumped from 3 → 4. Same framing as Wizard's Robe —
// the +3 read as "useful but unremarkable" in initial playtest, and the
// +4 brings the upside closer in line with the +20% MP-cost drawback.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const staffOfPower: WeaponEquipment = {
  id: itemId('staff_of_power'),
  name: 'Staff of Power',
  availability: 'available',
  kind: 'weapon',
  wp: 4,
  accuracy: 80,
  tags: ['staff'],
  statMods: { ma: 4 },
  mpCostMultipliers: [1.2],
};
