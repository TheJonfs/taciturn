// Wand of Expanse — TABA Ch2 second-pass AoE wand (M3 equipment
// expansion). WP 2, accuracy 90, +1 AoE shape-step on the wielder's
// magical area casts.
//
// The AoE-mage's wand: the equipment-side Aether Bloom. The rider runs
// the same `enlargeAoeShape` growth through the same `modifyAoeShape`
// chain (diamond/square/cross radius +1, line length +1), so it stacks
// with Aether Bloom itself for +2-step blooms, and with Battle
// Dictionary's AoE *elevation* (a different axis — the lineup doc's
// pairing note).
//
// Element-neutral (tags just ['wand']) — unlike the four element wands,
// Expanse serves whatever school the mage casts.
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfExpanse: WeaponEquipment = {
  id: itemId('wand_of_expanse'),
  name: 'Wand of Expanse',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  aoeShapeEnlargeModifiers: [{ steps: 1, tagFilter: ['magical'] }],
};
