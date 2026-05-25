// Talisman of Warding — universal off-hand elemental ward. +20 across
// the four primary elements; Mantle of Protection (+25 across six
// including Holy/Dark) remains the top-tier resistance accessory.
// Talisman is the off-hand-slot alternative for builds that prefer
// keeping the accessory slot free for non-resistance gear.

import { itemId, type ShieldEquipment } from '@engine/index.ts';

export const talismanOfWarding: ShieldEquipment = {
  id: itemId('talisman_of_warding'),
  name: 'Talisman of Warding',
  availability: 'available',
  kind: 'shield',
  resistanceMods: new Map([
    ['fire', 20],
    ['water', 20],
    ['earth', 20],
    ['lightning', 20],
  ]),
};
