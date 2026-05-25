// Buckler — universal off-hand defensive baseline. The first non-Knight-
// restricted shield-kind piece; opens the off-hand slot for every class
// without dual-wielding into a weapon. Tradeoffs: small evade, modest
// resistance, no stat mods — intentionally the worst-pick of the new
// off-hand tier (per S51 design intent). If playtest reads it as
// always-skipped, future tuning bumps the magnitude.

import { itemId, type ShieldEquipment } from '@engine/index.ts';

export const buckler: ShieldEquipment = {
  id: itemId('buckler'),
  name: 'Buckler',
  availability: 'available',
  kind: 'shield',
  evasionMods: { front: 10, side: 5 },
  resistanceMods: new Map([
    ['fire', 15],
    ['water', 15],
    ['earth', 15],
    ['lightning', 15],
  ]),
};
