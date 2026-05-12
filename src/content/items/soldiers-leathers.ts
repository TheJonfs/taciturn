// Soldier's Leathers — Knight-only offensive body armor. ~12.5% more
// turns over the battle arc (+1 Sp) plus +PA scaling on every swing.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const soldiersLeathers: ArmorEquipment = {
  id: itemId('soldiers_leathers'),
  name: "Soldier's Leathers",
  availability: 'available',
  kind: 'armor',
  classRestrictions: [classId('knight')],
  statMods: { maxHpBase: 90, spd: 1, pa: 1 },
};
