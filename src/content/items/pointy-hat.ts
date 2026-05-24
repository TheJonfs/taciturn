// Pointy Hat — Mage-only default head. Modest offensive boost, small
// MP buffer, plus targeted defense against Silence — the status that
// hardest-counters a Mage's identity. 50% Silence resistance composes
// as × 0.5 on the application formula.

import { classId, itemId, statusTypeId, type HeadgearEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
];

export const pointyHat: HeadgearEquipment = {
  id: itemId('pointy_hat'),
  name: 'Pointy Hat',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 10, maxMpBase: 20, ma: 1 },
  incomingStatusModifiers: [
    { kind: 'by_type', statusTypeId: statusTypeId('silence'), chanceMultiplier: 0.5 },
  ],
};
