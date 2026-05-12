// Staff of Power — quality-over-quantity magical generalist weapon.
// WP 4, accuracy 80.
//
// Per the equipment doc: +3 MA paired with × 1.20 MP cost on all spells.
// ~25% damage boost on basic spells in exchange for ~17% fewer total
// casts per battle (proportional to MP budget).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const staffOfPower: WeaponEquipment = {
  id: itemId('staff_of_power'),
  name: 'Staff of Power',
  availability: 'available',
  kind: 'weapon',
  wp: 4,
  accuracy: 80,
  tags: ['staff'],
  statMods: { ma: 3 },
  mpCostMultipliers: [1.2],
};
