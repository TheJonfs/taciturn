// Wand of the Deepwood — Earth-themed wand. WP 2, accuracy 90.
//
// Passive: +5 Spell Speed (faster charge) on Earth-tagged spells via
// the Session 27 `modifyActionSpeed` hook. The action speed boost
// shortens cast turnaround for Earth's status-application spells.
//
// On-hit effect (persistent ±25 resistance shift on the target) is
// deferred to Session 31 alongside the proc / on-hit infrastructure.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const wandOfDeepwood: WeaponEquipment = {
  id: itemId('wand_of_deepwood'),
  name: 'Wand of the Deepwood',
  availability: 'available',
  kind: 'weapon',
  wp: 2,
  accuracy: 90,
  tags: ['wand'],
  // `+5` is a speed bonus (higher actionSpeed value charges faster — see
  // ADR-0056). Tag-gated on 'earth' damage tag.
  actionSpeedModifiers: [{ delta: 5, tagFilter: ['earth'] }],
};
