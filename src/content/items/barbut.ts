// Barbut — Session 65 heavy headgear (Knight / Templar). HP +30 plus
// resistance to the disable statuses: incoming Stop / Don't Move / Don't
// Act each land at × 0.5 chance. The defensive half of the "control
// sub-game" — gear that earns its slot only because disables (Bull Rush
// knockback isn't a status, but Shadow Stitch's Stop, Pin Down's Don't
// Move, and Don't Act all are) now meaningfully threaten a front-liner.
//
// Mirrors the Pointy Hat's Silence-resistance mechanism (`incomingStatus-
// Modifiers`, by-type, × 0.5), generalized to three status types — one
// entry per type, each composing multiplicatively. Stacks with the
// universal Focus Band's by-tag `negative` × 0.75: all three disables
// carry the `negative` tag, so a Barbut + Focus Band wearer resists each
// at × 0.5 × 0.75 = × 0.375 (the standard multiplicative composition;
// not additive).

import { classId, itemId, statusTypeId, type HeadgearEquipment } from '@engine/index.ts';

export const barbut: HeadgearEquipment = {
  id: itemId('barbut'),
  name: 'Barbut',
  availability: 'available',
  kind: 'headgear',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 30 },
  incomingStatusModifiers: [
    { kind: 'by_type', statusTypeId: statusTypeId('stop'), chanceMultiplier: 0.5 },
    { kind: 'by_type', statusTypeId: statusTypeId('dont_move'), chanceMultiplier: 0.5 },
    { kind: 'by_type', statusTypeId: statusTypeId('dont_act'), chanceMultiplier: 0.5 },
  ],
};
