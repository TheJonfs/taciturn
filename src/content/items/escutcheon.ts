// Escutcheon — pure-tank Knight shield. Per the equipment doc: stacks
// with War Plate / Guard Cap to reach +60 elemental resistance across
// all four elements.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const escutcheon: ShieldEquipment = {
  id: itemId('escutcheon'),
  name: 'Escutcheon',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [classId('knight')],
  evasionMods: { front: 20, side: 10 },
  resistanceMods: new Map([
    ['fire', 10],
    ['water', 10],
    ['earth', 10],
    ['lightning', 10],
  ]),
};
