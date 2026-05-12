// Tintinibar — Auto-Regen accessory. Wearer enters battle with Regen
// status active. Currently Regen ticks via the per-application duration
// passed at apply time; Tintinibar's equipment-grant lifecycle wraps
// the Regen lifetime to "as long as Tintinibar is equipped" per
// ADR-0028.
//
// Watch-for: Regen's durationMode is `per_unit_ct` (not permanent),
// so the equipment statusGrants pipeline currently passes no duration
// and the apply path throws. Resolved by switching Regen to
// `permanent_per_unit_ct` for Auto-Regen-or-die semantics, OR by
// authoring a sibling `regen_auto` type. Tracked in handoff; for now
// the grant rides Regen as-is and tests pin this behavior so we
// notice when the apply contract changes.

import { itemId, statusTypeId, type AccessoryEquipment } from '@engine/index.ts';

export const tintinibar: AccessoryEquipment = {
  id: itemId('tintinibar'),
  name: 'Tintinibar',
  availability: 'available',
  kind: 'accessory',
  statusGrants: [statusTypeId('regen')],
};
