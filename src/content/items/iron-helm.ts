// Iron Helm — basic headgear. Per session 17c plaintext review,
// armor's primary stat is HP and headgear's secondary HP — this is the
// first headgear example, with a modest +20 maxHpBase. Heavy armor
// content with bigger numbers (or alternative stat profiles like MA-
// boosting hats) lands in tuning.

import { itemId, type HeadgearEquipment } from '@engine/index.ts';

export const ironHelm: HeadgearEquipment = {
  id: itemId('iron_helm'),
  name: 'Iron Helm',
  availability: 'hidden',
  kind: 'headgear',
  statMods: { maxHpBase: 20 },
};
