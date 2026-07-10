// Main Gauche — TABA Ch3 defensive duelist knife (M3 equipment
// expansion). WP 6, accuracy 95, F/S/B evade +20/+15/+10, knife-class
// Speed variance.
//
// The parrying knife: the only weapon granting BACK evade — a duelist
// who can't be cleanly flanked. Pairs with dual-wield (Two Weapons) for
// the offense hand + defense hand build; pairs with Shimmer Cloak /
// Stealth Suit for the full evasion-tank stack (counterplay: can't-miss
// effects and AoEs don't roll evasion).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const mainGauche: WeaponEquipment = {
  id: itemId('main_gauche'),
  name: 'Main Gauche',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'knife',
  wp: 6,
  accuracy: 95,
  tags: ['knife'],
  physicalVariance: { kind: 'attacker_speed', spread: 0.05 },
  evasionMods: { front: 20, side: 15, back: 10 },
};
