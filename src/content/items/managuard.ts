// Managuard — hybrid Knight shield. Per the equipment doc: +2 MA
// stacks with Silvered Vest for a Knight at MA 8, doubling Bolt Hammer's
// proc damage and bringing Knight's Lightning sub-magic from useless
// to legitimate.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const managuard: ShieldEquipment = {
  id: itemId('managuard'),
  name: 'Managuard',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [classId('knight'), classId('templar')], // S62: Templar shares Knight shields too
  evasionMods: { front: 10, side: 5 },
  statMods: { ma: 2 },
};
