// Command Cap — TABA Ch3 universal breadth head (M3 equipment
// expansion). HP +10, MP +10, +1 secondary command set, Speed −2.
//
// Universalizes the Magus Crown's breadth-enabling to non-mages: same
// `secondary_command_sets` bucket-capacity rider, but the cost is tempo
// (Speed −2) instead of the Crown's −3 MA — rough parity, different
// currency, so the two coexist as lane-appropriate versions of the same
// lesson (breadth pays, breadth costs).
//
// The command-set MECHANIC already works (Magus Crown ships in Mage
// War); the Formation Loadout tab's 2nd-secondary display is a known
// UI gap (S83 carry-over), not engine work.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { bucketId, itemId, type HeadgearEquipment } from '@engine/index.ts';

export const commandCap: HeadgearEquipment = {
  id: itemId('command_cap'),
  name: 'Command Cap',
  availability: 'hidden',
  kind: 'headgear',
  statMods: { maxHpBase: 10, maxMpBase: 10, spd: -2 },
  bucketCapacityMods: new Map([[bucketId('secondary_command_sets'), 1]]),
};
