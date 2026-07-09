// Iron Sword — TABA Ch1 vanilla sword (M3 equipment expansion). WP 5,
// accuracy 95, no riders: the gear-generation-1 Long Sword analog, the
// baseline the Ch1 sidegrades (Cutlass) trade against.
//
// WP 5 sits on the raised Ch1 WP floor (~4–5, per the lineup doc's
// physical-TTK compression across the chapter steps).
//
// TABA-only: `hidden` keeps it out of Mage War's frozen picker pool;
// the campaign equipment pool (chapter 1, shop) is its sole surface.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const ironSword: WeaponEquipment = {
  id: itemId('iron_sword'),
  name: 'Iron Sword',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 5,
  accuracy: 95,
  tags: ['sword'],
};
