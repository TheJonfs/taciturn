// Sensei's Gi — TABA Ch3 universal physical body (M3 equipment
// expansion). HP +130, PA +2, Speed +1: the Battle Gear heir — the
// highest-HP universal body, which makes it the de-facto Ch3 baseline
// for every class outside the Heavy/Magical lanes.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const senseisGi: ArmorEquipment = {
  id: itemId('senseis_gi'),
  name: "Sensei's Gi",
  availability: 'hidden',
  kind: 'armor',
  statMods: { maxHpBase: 130, pa: 2, spd: 1 },
};
