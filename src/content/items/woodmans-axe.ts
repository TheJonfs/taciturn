// Woodman's Axe — TABA Ch1 axe (M3 equipment expansion). WP 7, accuracy
// 75, static variance [0.9, 1.3]: the gear-generation-1 War Axe analog —
// same swingy identity (big-hit upside for miss-rate + noise) at Ch1
// scale. Effective WP across the band's mean: 7 × 0.75 × 1.1 ≈ 5.8 —
// a real upgrade over Iron Sword when it connects.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const woodmansAxe: WeaponEquipment = {
  id: itemId('woodmans_axe'),
  name: "Woodman's Axe",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'axe',
  wp: 7,
  accuracy: 75,
  tags: ['axe'],
  physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
};
