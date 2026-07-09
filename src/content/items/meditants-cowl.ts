// Meditant's Cowl — TABA Ch2 second-pass Magical head, MP/tempo lane
// (M3 equipment expansion). MP +40; magical casts charge +5 faster.
//
// The endurance-caster head: the biggest flat MP pool on a head slot,
// plus charge-time reduction. The lineup doc leaves the reduction
// magnitude open; authored at +5 action speed on magical-tagged casts —
// Livre of Urgency parity, one rider-slot's worth of tempo (stacks with
// Livre and Choir Staff for a dedicated tempo-caster build; watch that
// triple-stack in playtest).
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

export const meditantsCowl: HeadgearEquipment = {
  id: itemId('meditants_cowl'),
  name: "Meditant's Cowl",
  availability: 'hidden',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxMpBase: 40 },
  actionSpeedModifiers: [{ delta: 5, tagFilter: ['magical'] }],
};
