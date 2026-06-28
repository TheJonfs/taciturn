// Twist Headband — a universal head piece (S75). No class restriction, so
// every class can equip it. A small, generically-useful bump: +10 MaxHP and
// +2 PA, registered as additive `modifyStatQuery` contributions from the
// equipment tier (same path as Iron Helm's HP and Strength Ring's PA).
//
// PA-leaning rather than caster-leaning, so it reads as a martial/utility
// headband (the Golden Hairpin / Skullclamp fill the caster-head niche).

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const twistHeadband: HeadgearEquipment = {
  id: itemId('twist_headband'),
  name: 'Twist Headband',
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: 10, pa: 2 },
};
