// Escutcheon — pure-tank Knight shield. Per the equipment doc: stacks
// with War Plate / Guard Cap to reach a meaningful elemental resistance
// total across all four elements.
//
// S51 resistance bump: per-element +10 → +20. The pre-S51 +10 was a soft
// shrug at default damage scales (1.0× → 0.9×); the +20 lands at 0.8×,
// far enough out to feel earned. Stronger pieces (Guard Cap / War Plate
// at +25, Mantle of Protection at +25 across 6 tags) intentionally
// unchanged this pass — the bump is for the conservative tier only.

import { classId, itemId, type ShieldEquipment } from '@engine/index.ts';

export const escutcheon: ShieldEquipment = {
  id: itemId('escutcheon'),
  name: 'Escutcheon',
  availability: 'available',
  kind: 'shield',
  classRestrictions: [classId('knight')],
  evasionMods: { front: 20, side: 10 },
  resistanceMods: new Map([
    ['fire', 20],
    ['water', 20],
    ['earth', 20],
    ['lightning', 20],
  ]),
};
