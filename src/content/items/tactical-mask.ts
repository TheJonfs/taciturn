// Tactical Mask — Knight-only aggressive head. Stacks with Soldier's
// Leathers for a fast-bruiser package: PA 13, Sp 11, +110 HP combined.

import { classId, itemId, type HeadgearEquipment } from '@engine/index.ts';

export const tacticalMask: HeadgearEquipment = {
  id: itemId('tactical_mask'),
  name: 'Tactical Mask',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: [classId('knight')],
  statMods: { maxHpBase: 20, pa: 1, spd: 1 },
};
