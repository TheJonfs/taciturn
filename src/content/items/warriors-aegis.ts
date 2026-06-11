// Warrior's Aegis — aggressive Knight shield. Per the equipment doc:
// +2 PA is the main draw, stacking with Tactical Mask + Soldier's
// Leathers for a Knight at PA 14.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const warriorsAegis: ShieldEquipment = {
  id: itemId('warriors_aegis'),
  name: "Warrior's Aegis",
  availability: 'available',
  kind: 'shield',
  classRestrictions: [classId('knight'), classId('templar')], // S62: Templar shares Knight shields too
  evasionMods: { front: 5, side: 5 },
  statMods: { pa: 2 },
};
