// Void Robe — TABA Ch3 element-specialist robe, lightning/setup (M3
// equipment expansion). HP +95, MP +30; lightning damage the wearer
// deals marks the victim Vulnerable at a 50% Faith-scaled roll.
//
// Lightning (the tempo school) against type: the stormcaller becomes
// the setup pick — every bolt primes a ×1.5 amp for the team to
// collect. Rides the new spell-proc rider (`spellProcs`, the
// non-physical attackProcs sibling) firing `void_vulnerable_proc`,
// whose own baseChance-50 application does the MA/Faith-scaled rolling
// (Magnetic Mark's convention, delivered by gear). Vulnerable's REFRESH
// stacking answers the doc's stack question: re-marks re-arm, never
// compound.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { abilityId, classId, itemId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const voidRobe: ArmorEquipment = {
  id: itemId('void_robe'),
  name: 'Void Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 95, maxMpBase: 30 },
  spellProcs: [{ chance: 1, abilityId: abilityId('void_vulnerable_proc'), tagFilter: ['lightning'] }],
};
