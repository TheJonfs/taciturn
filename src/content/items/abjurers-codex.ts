// Abjurer's Codex — TABA Ch3 Magical off-hand, defense lane (M3
// equipment expansion). Adds the wearer's MA to all four elemental
// resistances.
//
// The defensive mage book — the other three Books do offense (Tome of
// Power), tempo (Livre of Urgency), and reach (Battle Dictionary); the
// Codex completes the quartet. MA-scaled → inherently mage-sided
// (~+30 at high MA, on par with Guard Cap's +25 flat but it grows with
// the build). First consumer of `resistanceFromMaTags` — the composed
// MA read (buffs and MA gear count). Counterplay: Scouring Wand's
// res shred.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const abjurersCodex: ShieldEquipment = {
  id: itemId('abjurers_codex'),
  name: "Abjurer's Codex",
  availability: 'hidden',
  kind: 'shield',
  classRestrictions: MAGE_CLASSES,
  resistanceFromMaTags: ['fire', 'water', 'earth', 'lightning'],
};
