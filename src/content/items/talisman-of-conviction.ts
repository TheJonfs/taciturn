// Talisman of Conviction — universal off-hand Brave/Faith piece. +5 to
// each. Brave raises status-application chance + reaction roll rates
// (and Absolom variance midpoint); Faith raises magical damage given
// AND received (the Faith × Faith composition). The dual-edged nature
// of Faith is intentional — a +5 talisman shouldn't be a free win.

import { itemId, type ShieldEquipment } from '@engine/index.ts';

export const talismanOfConviction: ShieldEquipment = {
  id: itemId('talisman_of_conviction'),
  name: 'Talisman of Conviction',
  availability: 'available',
  kind: 'shield',
  statMods: { brave: 5, faith: 5 },
};
