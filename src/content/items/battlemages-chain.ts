// Battlemage's Chain — Session 65 Heavy body armor (Knight / Templar). A
// pure stat block for the martial-caster hybrid line: HP +80, MP +10,
// MA +1. Shares the Knight/Templar "Heavy" body slot with War Plate /
// Soldier's Leathers / Spiked Mail.
//
// The +10 MP / +1 MA bump is aimed at the Templar (the
// tanky-self-sustainer on the S65 balance watch): it funds its spell kit
// while stacking the front-line HP a robe can't match. On a pure Knight
// it reads as a fat +80 HP body with inert caster stats — a fine bulk
// option. Restricted to Knight / Templar like the rest of the Heavy line
// (mages have their own robe slot; this isn't a robe substitute for them).

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const battlemagesChain: ArmorEquipment = {
  id: itemId('battlemages_chain'),
  name: "Battlemage's Chain",
  availability: 'available',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 80, maxMpBase: 10, ma: 1 },
};
