// Crusader's Helm — Knight-only headgear. Hybrid-caster piece: small HP
// + MP bump, Faith +10. Distinct from Pointy Hat (Mage-only): no MA
// boost; the Knight is fielding magical riders / future Knight cast
// abilities at a slightly stronger Faith without committing to a
// dedicated Mage head. Per the equipment doc's "tradeoffs not tiers"
// principle — Crusader's Helm is a sidegrade to Steel Helm and Tactical
// Mask along the magical-utility axis.

import { classId, itemId, type HeadgearEquipment } from '@engine/index.ts';

export const crusadersHelm: HeadgearEquipment = {
  id: itemId('crusaders_helm'),
  name: "Crusader's Helm",
  availability: 'available',
  kind: 'headgear',
  classRestrictions: [classId('knight')],
  statMods: { maxHpBase: 20, maxMpBase: 10, faith: 10 },
};
