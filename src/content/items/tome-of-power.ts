// Tome of Power — Book (mage off-hand). The straight-power Book:
// +1 MA, +10 MP. Pairs cleanly with Calculator's Math Skill (MA
// scaling on damage/heal/CT) and any mage's spell output.
//
// Book class restriction: the five mage classes (Geosage, Hydrologist,
// Pyromancer, Aethurge, Calculator) — i.e., the classes that wear
// Mage armor. Knights / Hunters / Assassins / Alchemists don't equip.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const tomeOfPower: ShieldEquipment = {
  id: itemId('tome_of_power'),
  name: 'Tome of Power',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [
    classId('earth_mage'),
    classId('water_mage'),
    classId('fire_mage'),
    classId('lightning_mage'),
    classId('calculator'),
  ],
  statMods: { ma: 1, maxMpBase: 10 },
};
