// Light Robe — Mage-only body armor. Specialized counterpart to Dark
// Robe: high single-pair elemental resistance (Fire / Lightning +75
// each) plus a meaningful HP cushion, trading away Sorcerer's Robe's
// Move +1 / Auto-Shell and the all-element coverage. Picked when an
// opponent roster leans Fire or Lightning. See `dark-robe.ts` for the
// Water / Earth counterpart.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
];

export const lightRobe: ArmorEquipment = {
  id: itemId('light_robe'),
  name: 'Light Robe',
  availability: 'available',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 75, maxMpBase: 20 },
  resistanceMods: new Map([
    ['fire', 75],
    ['lightning', 75],
  ]),
};
