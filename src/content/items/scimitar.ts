// Scimitar — Session 68. Sword, WP 7, accuracy 95. The power-for-tempo
// sword: one less WP than the Longsword (8) in exchange for +1 Speed
// (the Sai's rider — additive `statMods.spd`, which both accelerates CT
// accumulation and, for Speed-scaled weapons, feeds variance; swords
// are Speed-independent so here it's purely the tempo benefit).
//
// Sidegrade, not an upgrade: the WP-8 Longsword still hits harder per
// swing; the Scimitar trades that point of damage for turn economy. No
// sword-slot dominance concern.
//
// Weapon class: sword. Per the planner content reference, the sword/axe
// family is Speed-independent flat `PA × WP` — no `physicalVariance`
// (matching Longsword / Flametongue / Parrying Sword). Only the Knight
// Sword class (Absolom) carries the Brave-scaled band. (The S68 brief's
// "Brave-scaled variance" parenthetical was a slip; the binding intent
// is "sidegrade to the Longsword," which the no-variance match honors.)

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const scimitar: WeaponEquipment = {
  id: itemId('scimitar'),
  name: 'Scimitar',
  availability: 'available',
  kind: 'weapon',
  weaponType: 'sword',
  wp: 7,
  accuracy: 95,
  tags: ['sword'],
  statMods: { spd: 1 },
};
