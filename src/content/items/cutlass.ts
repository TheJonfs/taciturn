// Cutlass — TABA Ch1 defensive sword (M3 equipment expansion). WP 4,
// accuracy 95, +5 Front / +2 Side evade: the gear-generation-1 Parrying
// Sword analog (same trade shape at Ch1 scale — one WP below the Iron
// Sword baseline for per-facing evade; back stays uncovered, flanking
// remains the counter).
//
// Availability note (economy pass, deferred): story-gated to "Sword
// Town" per the lineup doc — recorded there, not modeled yet.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const cutlass: WeaponEquipment = {
  id: itemId('cutlass'),
  name: 'Cutlass',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 4,
  accuracy: 95,
  tags: ['sword'],
  evasionMods: { front: 5, side: 2 },
};
