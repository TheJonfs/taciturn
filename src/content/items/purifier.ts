// Purifier — graceful counter to status pressure. Doubles tick-down
// rate on incoming negative-tagged statuses via Session 28's
// `modifyStatusTickAmount` hook (ADR-0060). Burn, Poison, etc. tick
// down at × 2 normal rate. Status applications still land at full
// chance; they just don't stick.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const purifier: AccessoryEquipment = {
  id: itemId('purifier'),
  name: 'Purifier',
  availability: 'available',
  kind: 'accessory',
  statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }],
};
