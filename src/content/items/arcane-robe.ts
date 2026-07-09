// Arcane Robe — TABA Ch1 Magical body, defense lane (M3 equipment
// expansion). HP +10 / MP +20 / +25 all-element resistance: the
// flat-res generalist below the tailored Ch2 robes (Light/Dark Robe's
// +75-to-two-elements are the sharpened versions this one previews).
// The all-arounder choice against Linen Robe's offense.
//
// Mage-lane class restriction: same list the Ch2 robes carry.
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

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

export const arcaneRobe: ArmorEquipment = {
  id: itemId('arcane_robe'),
  name: 'Arcane Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 10, maxMpBase: 20 },
  resistanceMods: new Map([
    ['fire', 25],
    ['water', 25],
    ['earth', 25],
    ['lightning', 25],
  ]),
};
