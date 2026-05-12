// Capacitor Ring — hard counter to Lightning-element strategies. +100
// Lightning resistance produces full Lightning immunity on a unit with
// no native Lightning resistance; stacks with the Lightning Mage's
// native +50 to land in absorption territory (resistance ≥ 100 triggers
// ADR-0057's healing tag-flip).

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const capacitorRing: AccessoryEquipment = {
  id: itemId('capacitor_ring'),
  name: 'Capacitor Ring',
  availability: 'available',
  kind: 'accessory',
  resistanceMods: new Map([['lightning', 100]]),
};
