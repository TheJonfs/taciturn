// Tintinibar — Auto-Regen accessory. Wearer enters battle with the
// Auto-Regen status active for the duration of the battle.
//
// Session 31: switched the statusGrants target from `regen` (cast,
// `'per_unit_ct'` duration-counted) to `regen_auto` (battle-long,
// `'permanent_per_unit_ct'`). Tied to the equipment lifecycle per
// ADR-0028 — the status sticks as long as the accessory is equipped
// and unsticks if the item is removed. Cast Regen retains its
// timed semantics for Earth Mage's Buff ability.

import { itemId, statusTypeId, type AccessoryEquipment } from '@engine/index.ts';

export const tintinibar: AccessoryEquipment = {
  id: itemId('tintinibar'),
  name: 'Tintinibar',
  availability: 'available',
  kind: 'accessory',
  statusGrants: [statusTypeId('regen_auto')],
};
