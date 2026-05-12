// Wand of the Depths — Water-themed wand. WP 2, accuracy 90.
//
// Passive: +1 horizontal / +1 vertical range on Water-tagged spells via
// the Session 29 `modifyAbilityRange` hook.
//
// On-hit effect (persistent ±25 resistance shift on the target) is
// deferred to Session 31 alongside the proc / on-hit infrastructure.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfDepths: WeaponEquipment = {
  id: itemId('wand_of_depths'),
  name: 'Wand of the Depths',
  availability: 'available',
  kind: 'weapon',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  abilityRangeModifiers: [
    { deltaHorizontal: 1, deltaVertical: 1, tagFilter: ['water'] },
  ],
};
