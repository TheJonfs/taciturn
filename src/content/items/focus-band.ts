// Focus Band — universal head armor focused on status defense. Reduces
// incoming application chance for any 'negative'-tagged status by 25%
// (× 0.75 multiplicative on the application formula). Covers weapon-
// applied procs and spell-applied debuffs uniformly.

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const focusBand: HeadgearEquipment = {
  id: itemId('focus_band'),
  name: 'Focus Band',
  availability: 'available',
  kind: 'headgear',
  statMods: { maxHpBase: 10, maxMpBase: 10 },
  incomingStatusModifiers: [
    { kind: 'by_tag', statusTag: 'negative', chanceMultiplier: 0.75 },
  ],
};
