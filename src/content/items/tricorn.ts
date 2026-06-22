// Tricorn — Mage-only headgear. Hybrid-physical / reaction-trigger piece:
// thin HP / MP bump and Brave +10 to push the Mage's reaction firing
// probability up at a small cost. Pairs with a Mage carrying a physical
// attackProc weapon (Bolt Hammer's Lightning Strike rider) or a reaction
// passive (Discharge / Earth Resilience) where the Brave roll matters.

import { classId, itemId, type HeadgearEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const tricorn: HeadgearEquipment = {
  id: itemId('tricorn'),
  name: 'Tricorn',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 10, maxMpBase: 10, brave: 10 },
};
