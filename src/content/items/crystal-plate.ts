// Crystal Plate — TABA Ch3 Heavy baseline body (M3 equipment
// expansion). HP +200, +33 all-element res, Speed −1: the War Plate's
// heir, scaled up, drawback KEPT ("the wall is slow" — the lineup's
// ruling that preserves the trade the gimmick bodies compete against).
//
// Baseline availability (early-Ch3): a unit with no Ch3 body stalls a
// tier behind on HP entering the chapter, so the lane baseline arrives
// with the chapter (the profile sidegrades — Masterwork, Mithril — are
// the spaceable ones).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const crystalPlate: ArmorEquipment = {
  id: itemId('crystal_plate'),
  name: 'Crystal Plate',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 200, spd: -1 },
  resistanceMods: new Map([
    ['fire', 33],
    ['water', 33],
    ['earth', 33],
    ['lightning', 33],
  ]),
};
