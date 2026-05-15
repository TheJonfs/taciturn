// Lookout's Hood — universal headgear (any class). Speed +1 with a thin
// HP bump; rewards tempo-focused builds. Speed at parity with Boots of
// Haste's old framing, but in the head slot — frees the accessory slot
// for utility (Capacitor Ring, Rasp Pendant, etc.).

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const lookoutsHood: HeadgearEquipment = {
  id: itemId('lookouts_hood'),
  name: "Lookout's Hood",
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: 20, spd: 1 },
};
