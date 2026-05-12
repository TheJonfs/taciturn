// Wizard's Robe — Mage-only all-offense body armor. Per the equipment
// doc: ~25% basic spell damage boost plus the MP for more casts, but
// the wearer becomes broadly elementally vulnerable (-25 to all four
// elements). Stacks aggressively with Staff of Power.

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
];

export const wizardsRobe: ArmorEquipment = {
  id: itemId('wizards_robe'),
  name: "Wizard's Robe",
  availability: 'available',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 40, maxMpBase: 40, ma: 3 },
  resistanceMods: new Map([
    ['fire', -25],
    ['water', -25],
    ['earth', -25],
    ['lightning', -25],
  ]),
};
