// Mithril Chain — TABA Ch3 Heavy battlemage body (M3 equipment
// expansion). HP +120, MP +20, MA +2, casts charge +5 faster: the
// Battlemage's Chain heir, serving the armored hybrid (Templar) — real
// Heavy bulk with a caster package on top.
//
// The action-speed rider is unscoped (all charged actions, not just
// magical) per the lineup's plain "action speed +5" — an armored caster
// charges everything a touch faster.
//
// Profile sidegrade — spaceable to a location (a mage-tower, per the
// lineup's diegetic-gating rule).
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, type ArmorEquipment } from '@engine/index.ts';

export const mithrilChain: ArmorEquipment = {
  id: itemId('mithril_chain'),
  name: 'Mithril Chain',
  availability: 'hidden',
  kind: 'armor',
  classRestrictions: [classId('knight'), classId('templar')],
  statMods: { maxHpBase: 120, maxMpBase: 20, ma: 2 },
  actionSpeedModifiers: [{ delta: 5 }],
};
