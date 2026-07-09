// Chain Shirt — TABA Ch1 Heavy body (M3 equipment expansion). HP +80,
// +15 all-element resistance: the scaled-down War Plate (HP +150 / +25
// res / −1 Speed at Ch2) without the Speed cost — the res-tank identity
// at Ch1 numbers.
//
// The lone Ch1 Heavy body by design ("Heavy skeletal — Chris is the
// lone early Heavy customer", lineup doc): the Heavy lane doesn't get
// choices until Ch2, it gets existence. Suits Chris the cover-tank.
//
// Heavy lane = Knight/Templar class restriction (S62 convention: the
// Templar shares Knight head/body gear).
//
// TABA-only: `hidden` + campaign pool (chapter 1, shop).

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const chainShirt: ArmorEquipment = {
  id: itemId('chain_shirt'),
  name: 'Chain Shirt',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 80 },
  resistanceMods: new Map([
    ['fire', 15],
    ['water', 15],
    ['earth', 15],
    ['lightning', 15],
  ]),
};
