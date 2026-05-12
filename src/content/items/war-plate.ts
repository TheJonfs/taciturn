// War Plate — Knight-only magic-tank body armor. Per the equipment doc:
// Knight in War Plate has better all-element defense than any Mage has
// against non-self elements — reinforces "Knight is the elemental
// neutral pick." Speed cost is -1.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const warPlate: ArmorEquipment = {
  id: itemId('war_plate'),
  name: 'War Plate',
  availability: 'available',
  kind: 'armor',
  classRestrictions: [classId('knight')],
  statMods: { maxHpBase: 150, spd: -1 },
  resistanceMods: new Map([
    ['fire', 25],
    ['water', 25],
    ['earth', 25],
    ['lightning', 25],
  ]),
};
