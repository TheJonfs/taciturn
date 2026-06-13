// Battlemage's Chain — Session 65 body armor. A pure stat block for the
// hybrid line: HP +80, MP +10, MA +1. No class restriction — it's the
// flexible body option that trades a robe's elemental resistance (Light /
// Dark / Sorcerer's Robe) for raw durability plus a thin caster bump.
//
// Universal by design: a mage can field it as a tankier alternative to a
// robe; the Templar (the tanky-self-sustainer on the S65 balance watch)
// can stack its HP under the existing Knight/Templar body line. The MA +1
// is near-inert on a pure martial, so the soft filter is "do you cast at
// all" rather than a hard `classRestrictions` gate.

import { itemId, type ArmorEquipment } from '@engine/index.ts';

export const battlemagesChain: ArmorEquipment = {
  id: itemId('battlemages_chain'),
  name: "Battlemage's Chain",
  availability: 'available',
  kind: 'armor',
  statMods: { maxHpBase: 80, maxMpBase: 10, ma: 1 },
};
