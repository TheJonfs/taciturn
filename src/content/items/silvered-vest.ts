// Silvered Vest — universal "non-mage wanting magic" body armor. For a
// Knight running Bolt Hammer or Lightning Magic as secondary, the +2 MA
// and +30 MP unlock a real magical contribution.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const silveredVest: ArmorEquipment = {
  id: itemId('silvered_vest'),
  name: 'Silvered Vest',
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 50, maxMpBase: 30, ma: 2 },
};
