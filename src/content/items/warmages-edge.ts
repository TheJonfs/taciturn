// Warmage's Edge — TABA Ch2 second-pass hybrid sword (M3 equipment
// expansion). WP 6, accuracy 95, PA +1 / MA +2: the first genuinely
// dual-stat weapon — Ch2 is where hybrids arrive (Terraformer, Templar).
//
// WP 6 matches the Parrying Sword / Flametongue tier (the sidegrade
// band below the vanilla WP 8): the Edge pays two WP for stats that
// feed BOTH halves of a hybrid kit. A pure-PA class wants the Long
// Sword; a pure-MA class wants a staff; only the dual-stat user
// collects the whole package — the power-location discipline that
// keeps hybrids from becoming the default.
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const warmagesEdge: WeaponEquipment = {
  id: itemId('warmages_edge'),
  name: "Warmage's Edge",
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 6,
  accuracy: 95,
  tags: ['sword'],
  statMods: { pa: 1, ma: 2 },
};
