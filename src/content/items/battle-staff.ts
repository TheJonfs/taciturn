// Battle Staff — TABA Ch3 staff (M3 equipment expansion). WP 5,
// accuracy 80, MA +2; weapon attacks use MA instead of PA
// (MA × 5 × coefficient — MP-free MA-melee for casters).
//
// The mage's "I'm out of MP but not out of fight" weapon: a MA-12
// caster swings for ~60 pre-variance where their PA-3 arm would manage
// ~15. First consumer of `attackStat` (the Stage 3b engine seam;
// Barehanded's WP=PA formula override is the departure precedent). MA
// buffs compose through the same modifyStatQuery chain PA buffs do.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const battleStaff: WeaponEquipment = {
  id: itemId('battle_staff'),
  name: 'Battle Staff',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 5,
  accuracy: 80,
  tags: ['staff'],
  statMods: { ma: 2 },
  attackStat: 'ma',
};
