// Steel Helm — Knight-only reaction-tank head. The +1 R-capacity opens
// reaction-ability budgets that wouldn't fit baseline 3-capacity; the
// -20 Side/Back Evade is a *positive-feedback* cost (more hits → more
// reactions → more counter-damage) per the equipment doc's "Knight
// wants to get hit" identity. Negative-evasion semantics are
// intentional; the final [0.05, 1.0] hit-chance clamp prevents
// overflow above 100% from those facings.

import {
  bucketId,
  classId,
  itemId,
  type HeadgearEquipment,
} from '@engine/index.ts';

export const steelHelm: HeadgearEquipment = {
  id: itemId('steel_helm'),
  name: 'Steel Helm',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: [classId('knight')],
  statMods: { maxHpBase: 40 },
  bucketCapacityMods: new Map([[bucketId('reaction'), 1]]),
  evasionMods: { side: -20, back: -20 },
};
