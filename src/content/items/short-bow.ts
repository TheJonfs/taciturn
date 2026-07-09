// Short Bow — TABA Ch1 bow (M3 equipment expansion). WP 3, accuracy 40,
// the full bow range/variance package at gear-generation-1 scale: the
// Longbow's profile (range 2–5 with the adjacent dead zone, effectively
// unbounded vertical, height-delta damage variance, range-from-height)
// with the numbers walked down to Ch1.
//
// Accuracy 40 bare is deliberately Hunter-shaped — Eagle Eye doubles it
// to ~80% net (the lineup doc's note), so the Ch1 bow teaches the same
// "the passive is the weapon's other half" lesson the Longbow anchors
// at Ch2.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const shortBow: WeaponEquipment = {
  id: itemId('short_bow'),
  name: 'Short Bow',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'bow',
  wp: 3,
  accuracy: 40,
  tags: ['bow'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 },
};
