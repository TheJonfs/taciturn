// Dark Robe — Mage-only body armor. Specialized counterpart to Light
// Robe: high single-pair elemental resistance (Water / Earth +75 each)
// plus a meaningful HP cushion, trading away Sorcerer's Robe's Move +1
// / Auto-Shell and the all-element coverage. Picked when an opponent
// roster leans Water or Earth. See `light-robe.ts` for the Fire /
// Lightning counterpart.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const darkRobe: ArmorEquipment = {
  id: itemId('dark_robe'),
  name: 'Dark Robe',
  availability: 'available',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 75, maxMpBase: 20 },
  resistanceMods: new Map([
    ['water', 75],
    ['earth', 75],
  ]),
};
