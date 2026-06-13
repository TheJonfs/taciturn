// Circlet — Session 65 mage headgear. HP +10, MP +10, plus per-turn MP
// regeneration: it grants the `mana_font` status at battle start, which
// restores floor(MA / 2) MP on the wearer's CT tick (≈ once per turn).
//
// The sustain answer to the S65 MP rebaseline (the four elemental mages
// 60 → 48, Calculator 47 → 37). The regen only earns its head slot
// because MP is now scarce — at MA 12 that's +6 MP/turn, roughly one
// extra Strike's worth across two turns; at the Calculator's MA 9, +4.
// Granted-status lifecycle mirrors Auto-Regen via Tintinibar (regen_auto)
// — see mana-font.ts.
//
// Same `MAGE_CLASSES` allowlist as the Pointy Hat / Tricorn: the four
// elemental mages plus Calculator and Terraformer (the MP-spending
// casters). Competes with Pointy Hat (Silence resist), Magus Crown (+1
// command set), and Golden Hairpin (MP-cost halving) for the head slot —
// flat regen vs. cost reduction vs. utility is the choice.

import { classId, itemId, statusTypeId, type HeadgearEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
];

export const circlet: HeadgearEquipment = {
  id: itemId('circlet'),
  name: 'Circlet',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 10, maxMpBase: 10 },
  statusGrants: [statusTypeId('mana_font')],
};
