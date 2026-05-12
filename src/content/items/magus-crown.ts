// Magus Crown — Mage-only build-shaping head. The +1
// `secondary_command_sets` capacity lets the wearer equip two secondary
// command sets (vs. baseline 1), opening massive ability variety. Cost
// is -3 MA (~25% basic spell damage reduction at L25). Power-vs-
// flexibility trade; calibration may need tuning during playtest.

import {
  bucketId,
  classId,
  itemId,
  type HeadgearEquipment,
} from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
];

export const magusCrown: HeadgearEquipment = {
  id: itemId('magus_crown'),
  name: 'Magus Crown',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { ma: -3 },
  bucketCapacityMods: new Map([[bucketId('secondary_command_sets'), 1]]),
};
