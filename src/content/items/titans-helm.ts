// Titan's Helm — TABA Ch3 Heavy pure-defense head (M3 equipment
// expansion). HP +30, F/S/B evade +10/+10/+5, +20 all-element res.
//
// Deliberately double-dips dodge AND mitigation — that's its single-job
// identity (pure defense, nothing else), per the lineup ruling. Watch:
// max-tank durability stacked with Crystal Plate; counterplay exists
// (can't-miss effects, Scouring Wand's res shred).
//
// Heads carry no HP scaling in Ch3 (bodies do) — the Ch2 heads stay
// viable by carry-forward; this adds a new endgame EFFECT, not an
// upgrade.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type HeadgearEquipment } from '@engine/index.ts';

export const titansHelm: HeadgearEquipment = {
  id: itemId('titans_helm'),
  name: "Titan's Helm",
  availability: 'hidden',
  kind: 'headgear',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 30 },
  evasionMods: { front: 10, side: 10, back: 5 },
  resistanceMods: new Map([
    ['fire', 20],
    ['water', 20],
    ['earth', 20],
    ['lightning', 20],
  ]),
};
