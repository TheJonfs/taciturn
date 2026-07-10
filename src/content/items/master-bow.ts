// Master Bow — TABA Ch3 Hunter-optimized bow (M3 equipment expansion).
// WP 11, accuracy 40, Speed −1; the full bow package (range 2–5,
// height-delta variance, range-from-height).
//
// The Longbow's heir on the same accuracy-starved profile: bare 40%
// only pays with Eagle Eye (→ 80%) — Hunter-optimized by construction.
// The Speed −1 is the brute tax; the Sniper Bow is the reliable sibling
// (native 80, lower WP) for everyone else.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const masterBow: WeaponEquipment = {
  id: itemId('master_bow'),
  name: 'Master Bow',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'bow',
  wp: 11,
  accuracy: 40,
  tags: ['bow'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
  statMods: { spd: -1 },
};
