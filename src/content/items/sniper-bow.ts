// Sniper Bow — TABA Ch3 reliable bow (M3 equipment expansion). WP 7,
// accuracy 80; the full bow package (range 2–5, height-delta variance,
// range-from-height).
//
// The generalist sibling to the Master Bow: native 80% needs no passive
// (any class with a bow slot can run it), and a Hunter's Eagle Eye
// doubles it into can't-miss consistency (clamped at 100). Lower WP is
// the price of reliability — the intra-family choice the Ch3 "interesting
// bar" asks for.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const sniperBow: WeaponEquipment = {
  id: itemId('sniper_bow'),
  name: 'Sniper Bow',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'bow',
  wp: 7,
  accuracy: 80,
  tags: ['bow'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
};
