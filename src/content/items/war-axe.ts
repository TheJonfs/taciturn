// War Axe — high-WP, low-accuracy physical weapon. WP 12, accuracy 75.
//
// Per the equipment doc: ~30% damage upgrade vs Long Sword in exchange
// for 25% miss rate plus variance noise. The "high asymmetric variance
// [0.9, 1.3]" identity feature ships when an engine seam for weapon-
// sourced variance lands (currently variance lives on the ability,
// not the weapon — see Session 29 handoff for the carry-forward).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const warAxe: WeaponEquipment = {
  id: itemId('war_axe'),
  name: 'War Axe',
  availability: 'available',
  kind: 'weapon',
  wp: 12,
  accuracy: 75,
  tags: ['axe'],
};
