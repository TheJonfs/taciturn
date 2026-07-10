// Star Robe — TABA Ch3 element-specialist robe, fire/sustain (M3
// equipment expansion). HP +95, MP +30; the wearer heals 25% of the
// fire damage they deal.
//
// Fire (the burst school) against type: the pyromancer becomes the
// sustain pick. Rides the new equipment lifesteal rider
// (`damageLifestealMods`, Rasp Pendant's drain shape pointed at HP).
// Ch3 damage-taken (hundreds/hit) outpaces the faucet, per the lineup's
// durability analysis — it shrugs chip, not focus.
//
// Open-register watch (shipped uncapped): the Calculator field-wide
// case — lifesteal fires PER DAMAGED TARGET, so a battlefield-wide fire
// Math cast drinks from every victim. Playtest; per-cast cap is the
// fix-if-needed.
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

export const starRobe: ArmorEquipment = {
  id: itemId('star_robe'),
  name: 'Star Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 95, maxMpBase: 30 },
  damageLifestealMods: [{ percent: 25, tagFilter: ['fire'] }],
};
