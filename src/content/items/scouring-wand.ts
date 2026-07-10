// Scouring Wand — TABA Ch3 team-setup wand (M3 equipment expansion).
// WP 3, accuracy 90; every landed physical poke applies a stack of
// Scoured (−33 ALL elemental resistances, permanent, accumulating).
//
// The deliberate meta-hedge against high-resistance strategies (player
// or Ch3 enemy). UNBOUNDED by ruling — resistance has no floor, so
// stacks scale damage-taken linearly forever; the opportunity cost
// (WP-3 pokes instead of real actions) is the balance. Dual-wield
// accelerates stacking (a proc per landed swing) — the register's
// watch item.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const scouringWand: WeaponEquipment = {
  id: itemId('scouring_wand'),
  name: 'Scouring Wand',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'wand',
  wp: 3,
  accuracy: 90,
  tags: ['wand'],
  attackProcs: [{ chance: 1, abilityId: abilityId('apply_scoured_proc') }],
};
