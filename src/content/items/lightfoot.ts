// Lightfoot — mobility specialist accessory. +1 Move, +1 Jump, +1 Speed.
// Per the equipment doc: enables the "skirmisher" archetype that
// doesn't otherwise exist.

import { itemId, type AccessoryEquipment } from '@engine/index.ts';

export const lightfoot: AccessoryEquipment = {
  id: itemId('lightfoot'),
  name: 'Lightfoot',
  availability: 'available',
  kind: 'accessory',
  statMods: { spd: 1 },
  movementMods: { moveRange: 1, jump: 1 },
};
