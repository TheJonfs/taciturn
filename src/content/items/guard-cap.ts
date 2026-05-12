// Guard Cap — universal head armor with broad elemental defense. Stacks
// additively with War Plate / Escutcheon / Mage natural resistances.

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const guardCap: HeadgearEquipment = {
  id: itemId('guard_cap'),
  name: 'Guard Cap',
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: 20 },
  resistanceMods: new Map([
    ['fire', 25],
    ['water', 25],
    ['earth', 25],
    ['lightning', 25],
  ]),
};
