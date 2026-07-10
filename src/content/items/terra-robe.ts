// Terra Robe — TABA Ch3 element-specialist robe, earth/snowball (M3
// equipment expansion). HP +95, MP +30; each earth-damage spell the
// wearer resolves grants +1 MA (stacking, rest of battle).
//
// Earth (the control school) against type: the geomancer becomes the
// scaling pick. ONCE PER SPELL, not per target — the load-bearing cap
// (lineup ruling): the rider lives on `onActionResolved`
// (`spellResolvedSelfStatuses`), so a field-wide Cataclysm grants one
// Terra Attunement stack, same as a single-target poke. Slow earned
// ramp (~+6 damage/turn/stack on Cataclysm), battle-length-bounded by
// construction — no cap needed.
//
// Open-register note: possibly UNDER-powered / the long-fight robe —
// verify at playtest, don't pre-buff.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, statusTypeId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const terraRobe: ArmorEquipment = {
  id: itemId('terra_robe'),
  name: 'Terra Robe',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 95, maxMpBase: 30 },
  spellResolvedSelfStatuses: [
    { statusTypeId: statusTypeId('terra_attunement'), damageTagAll: ['earth'] },
  ],
};
