// Masterwork Mail — TABA Ch3 Heavy aggressive-tank body (M3 equipment
// expansion). HP +140, reflects 33% of physical damage, PA +1: the
// Spiked Mail's heir (20% → 33% reflect, plus the PA rider that makes
// it the AGGRESSIVE tank against Crystal Plate's wall).
//
// Reflect rides the Session-37 revenge path (`system_damage`, pipeline-
// bypassing — no reflect loops). With Mirror Shield in the off-hand the
// wearer reflects both damage kinds: the full thorns tank.
//
// Profile sidegrade — spaceable to a location (a forge, per the lineup's
// diegetic-gating rule).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const masterworkMail: ArmorEquipment = {
  id: itemId('masterwork_mail'),
  name: 'Masterwork Mail',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 140, pa: 1 },
  physicalReflectPercent: 33,
};
