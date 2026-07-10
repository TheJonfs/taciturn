// Moon Robe — TABA Ch3 element-specialist robe, water/burst (M3
// equipment expansion). HP +95, MP +30; water-tagged spell damage ×1.5.
//
// The robes play each element AGAINST type — water (utility school)
// becomes the burst pick. The ×1.5 is a deliberate REBALANCE of the
// least-used damage school toward viability, not power creep (lineup
// ruling). Rides the new multiplicative Spell Power entry (`factor`),
// applied after every additive SP delta.
//
// Open-register watch: ×Conductor stacking (1.875× total) risks
// over-correcting — confirm at playtest.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

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

export const moonRobe: ArmorEquipment = {
  id: itemId('moon_robe'),
  name: 'Moon Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 95, maxMpBase: 30 },
  spellPowerModifiers: [{ delta: 0, factor: 1.5, tagFilter: ['water'] }],
};
