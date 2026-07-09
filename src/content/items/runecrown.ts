// Runecrown — TABA Ch2 second-pass Magical head, caster-power lane (M3
// equipment expansion). MP +20, MA +2, +1 Spell Power on every spell.
//
// The offense head against Pointy Hat's Silence-insurance — a real
// choice, not an upgrade (lineup doc). The +1 SP rides the unfiltered
// `spellPowerModifiers` chain (the Wand of Potential rider without the
// element gate): +1 to the magical power coefficient on every damage
// spell the wearer casts.
//
// Mage-lane class restriction: same list the robes carry.
//
// TABA-only: `hidden` + campaign pool (chapter 2, shop).

import { classId, itemId, type HeadgearEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const runecrown: HeadgearEquipment = {
  id: itemId('runecrown'),
  name: 'Runecrown',
  availability: 'hidden',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxMpBase: 20, ma: 2 },
  spellPowerModifiers: [{ delta: 1 }],
};
