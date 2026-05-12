// Battle Gear — universal "plain durability" body armor. Higher HP than
// Soldier's Leathers without the Speed/Knight-only constraint.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const battleGear: ArmorEquipment = {
  id: itemId('battle_gear'),
  name: 'Battle Gear',
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 110, pa: 1 },
};
