// Linen Robe — TABA Ch1 Magical body, offense lane (M3 equipment
// expansion). HP +20 / MP +20 / MA +2: the gear-generation-1 echo of
// the Wizard's Robe direction (damage now, durability later) without
// the Ch2 robe's elemental-vulnerability downside — Ch1 armor teaches
// the lane shapes before the tradeoffs sharpen.
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

export const linenRobe: ArmorEquipment = {
  id: itemId('linen_robe'),
  name: 'Linen Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 20, maxMpBase: 20, ma: 2 },
};
