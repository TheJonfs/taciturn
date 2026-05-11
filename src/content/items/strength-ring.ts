// Strength Ring — accessory that exercises the equipment-as-stat-mod
// path. Per ADR-0028, equipment statMods register as `modifyStatQuery`
// handlers from the equipment hook source tier; this ring's +1 PA
// composes with PA-querying base handlers (the physical damage stage
// reads `runModifyStatQuery({ statName: 'pa', baseValue })` so the
// ring's contribution lands additively).
//
// Numbers per session 17c plaintext review: +1 PA, no other stats. A
// future "Power Ring" with bigger PA and tradeoff stats lands in
// content tuning. Cost / rarity gating is downstream — the v1 catalog
// has no progression.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const strengthRing: AccessoryEquipment = {
  id: itemId('strength_ring'),
  name: 'Strength Ring',
  availability: 'hidden',
  kind: 'accessory',
  statMods: { pa: 1 },
};
