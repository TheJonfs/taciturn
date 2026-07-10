// Channeler's Hat — TABA Ch3 Magical head (M3 equipment expansion).
// HP +20, MP +10; incoming damage is HALVED while the wearer is
// charging.
//
// Patches the charging-mage vulnerability window (charging units are
// auto-hit — the reason the window is scary). First consumer of
// `conditionalIncomingDamageMods` (the Stage 3c engine seam): the item
// names the gating status ('charging', the ruleset's charge marker), so
// the engine stays generic for future while-status gear. Stacks
// multiplicatively with Protect (×0.25 physical while charging) — the
// lineup's watch item for big-nuke charge safety.
//
// Mage-lane class restriction: same list the robes carry.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { classId, itemId, statusTypeId, type HeadgearEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
  classId('calculator'),
  classId('terraformer'),
  classId('enchanter'),
];

export const channelersHat: HeadgearEquipment = {
  id: itemId('channelers_hat'),
  name: "Channeler's Hat",
  availability: 'hidden',
  kind: 'headgear',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 20, maxMpBase: 10 },
  conditionalIncomingDamageMods: [{ factor: 0.5, whileStatusTypeId: statusTypeId('charging') }],
};
