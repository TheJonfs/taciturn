// Imp Halberd — the Lance variant (S62, Templar arc). WP 8, accuracy 95,
// two-handed, reach H2 / V4, pierces, static variance [0.9, 1.1], MA +1.
//
// The variant trade: −2 WP for +1 MA, favouring the healer / Jump-light
// build over the striker. The MA +1 compounds the multiplicative healing
// stack (Cure / Raise scale on MA) — see templar-concept-notes' playtest
// watch. Same pierce mechanic as the vanilla Lance (ADR-0102).
//
// Universal (no classRestrictions). Tags `['lance']` mark the weapon class.
// (Flavour note from the concept-notes — "Imp" reads demonic on a holy
// knight; kept per Chris over "Imperial".)

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const impHalberd: WeaponEquipment = {
  id: itemId('imp_halberd'),
  name: 'Imp Halberd',
  availability: 'available',
  kind: 'weapon',
  wp: 8,
  accuracy: 95,
  tags: ['lance'],
  twoHanded: true,
  range: { min: 1, max: 2, vertical: 4 },
  pierces: true,
  physicalVariance: { kind: 'static', min: 0.9, max: 1.1 },
  statMods: { ma: 1 },
};
