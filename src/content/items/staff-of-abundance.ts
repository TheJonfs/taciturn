// Staff of Abundance — quantity-over-quality magical generalist weapon.
// WP 4, accuracy 80.
//
// Per the equipment doc: MaxMP × 1.5 paired with −5 Spell Speed (slower
// charge) on all spells. ~50% more total casts per battle in exchange
// for longer turnaround per cast.
//
// The maxMp multiplier composes via Session 28's
// `statModsMultiplicative` (additive-then-multiplicative within the
// Equipment tier per ADR-0058); the speed delta gates on no tag (empty
// filter omitted → applies to all abilities).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const staffOfAbundance: WeaponEquipment = {
  id: itemId('staff_of_abundance'),
  name: 'Staff of Abundance',
  availability: 'available',
  kind: 'weapon',
  wp: 4,
  accuracy: 80,
  tags: ['staff'],
  statModsMultiplicative: { maxMp: 1.5 },
  actionSpeedModifiers: [{ delta: -5 }],
};
