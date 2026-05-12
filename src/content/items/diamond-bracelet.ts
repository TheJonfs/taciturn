// Diamond Bracelet — universal stat-boost accessory. Modest +1 PA / +1
// MA, most useful for hybrid PA/MA builds where both stats matter.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const diamondBracelet: AccessoryEquipment = {
  id: itemId('diamond_bracelet'),
  name: 'Diamond Bracelet',
  availability: 'available',
  kind: 'accessory',
  statMods: { pa: 1, ma: 1 },
};
