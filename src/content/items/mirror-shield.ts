// Mirror Shield — TABA Ch3 Heavy off-hand (M3 equipment expansion).
// F/S evade +10/+5, reflects 20% of MAGICAL damage.
//
// The magical mirror of Spiked Mail — fills the magical-reflect gap.
// First consumer of `magicalReflectPercent` (the generalized reflect
// contributor; same revenge-emission path, `['magical']` tags). With
// Spiked Mail or Masterwork Mail on the body, the wearer reflects both
// damage kinds: the full-reflect thorns tank the lineup grins about.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const mirrorShield: ShieldEquipment = {
  id: itemId('mirror_shield'),
  name: 'Mirror Shield',
  availability: 'hidden',
  kind: 'shield',
  classRestrictions: [classId('knight'), classId('templar')],
  evasionMods: { front: 10, side: 5 },
  magicalReflectPercent: 20,
};
