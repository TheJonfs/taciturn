// Sorcerer's Robe — Mage-only defensive body armor. Per the equipment
// doc: Auto-Shell (50% reduction on incoming magic damage) effectively
// converts the Mage's natural -50 elemental vulnerability into a slight
// resistance against magic. Move +1 makes them harder to pin down for
// physical attackers.

import { classId, itemId, statusTypeId, type ArmorEquipment } from '@engine/index.ts';

const MAGE_CLASSES = [
  classId('earth_mage'),
  classId('water_mage'),
  classId('fire_mage'),
  classId('lightning_mage'),
];

export const sorcerersRobe: ArmorEquipment = {
  id: itemId('sorcerers_robe'),
  name: "Sorcerer's Robe",
  availability: 'available',
  kind: 'armor',
  classRestrictions: MAGE_CLASSES,
  statMods: { maxHpBase: 30, maxMpBase: 30 },
  // Auto-Shell: equipment-granted permanent Shell status (see
  // src/content/statuses/shell.ts). The grant lands at battle start;
  // composition via signedMax means a future cast Shell with magnitude
  // > 50 supersedes for its duration, falling back to this baseline.
  statusGrants: [statusTypeId('shell')],
  // "Move +1" — +1 moveRange so the wearer can step one extra tile per
  // Move action, matching the equipment doc's framing ("harder to pin
  // down for physical attackers"). Composes via the Session 29
  // movementMods contributor that emits a `modifyStatQuery('moveRange')`
  // handler.
  movementMods: { moveRange: 1 },
};
