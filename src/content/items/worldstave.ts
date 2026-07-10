// Worldstave — TABA Ch3 hybrid staff (M3 equipment expansion). WP 8,
// accuracy 80, PA +2 / MA +2.
//
// The Warmage's Edge's Ch3 big sibling: serves hybrids ONLY (a pure-PA
// class wants the higher-WP martial weapons, a pure-MA caster wastes
// the PA and wants Runic/Power MA-stacking) — the power-location
// discipline that keeps the dual-stat piece from being generalist-
// dominant. WP 8 makes the staff swing itself respectable, which is
// the point: the hybrid actually attacks.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const worldstave: WeaponEquipment = {
  id: itemId('worldstave'),
  name: 'Worldstave',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'staff',
  wp: 8,
  accuracy: 80,
  tags: ['staff'],
  statMods: { pa: 2, ma: 2 },
};
