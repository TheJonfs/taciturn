// Staff of Power — quality-over-quantity magical generalist weapon.
// WP 4, accuracy 80.
//
// Per the equipment doc: +MA paired with × 1.50 MP cost on all spells.
// Heavy damage boost in exchange for a third fewer total casts per battle
// (proportional to MP budget).
//
// Session 31.5: +MA bumped from 3 → 4. Same framing as Wizard's Robe —
// the +3 read as "useful but unremarkable" in initial playtest, and the
// +4 brings the upside closer in line with the MP-cost drawback.
//
// Session 55: MP-cost multiplier tuned 1.20 → 1.50 (Chris's call). The +4 MA
// upside now buys a steeper economy hit — watch the Pyromancer MP squeeze.

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
  mpCostMultipliers: [1.5],
};
