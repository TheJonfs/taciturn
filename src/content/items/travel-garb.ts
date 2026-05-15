// Travel Garb — universal body armor (any class). Trades the higher HP
// of Battle Gear and the elemental resistances of the mage robes for a
// Move +1 mobility bump. Pairs with low-Move classes that want to cover
// more ground without leaning on a Lightfoot accessory slot.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const travelGarb: ArmorEquipment = {
  id: itemId('travel_garb'),
  name: 'Travel Garb',
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 80 },
  movementMods: { moveRange: 1 },
};
