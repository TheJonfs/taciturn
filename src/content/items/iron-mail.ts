// Iron Mail — basic armor. Heavier than Iron Helm at +30 maxHpBase
// (per session 17c plaintext review — convention is armor >= headgear
// for HP). Combined with Iron Helm and a base 60 HP Knight, the unit
// fields at 110 HP — meaningful frontline durability without breaking
// today's tuning.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const ironMail: ArmorEquipment = {
  id: itemId('iron_mail'),
  name: 'Iron Mail',
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 30 },
};
