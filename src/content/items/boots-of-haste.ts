// Boots of Haste — accessory that exercises the equipment-as-status-
// source path. Per ADR-0028, equipment `statusGrants` apply at battle
// start with `StatusInstanceSource = { kind: 'equipment', equipmentId }`;
// the resulting Haste instance is immune to in-battle removal until
// the boots themselves are removed (deferred).
//
// Haste's durationMode is `permanent_per_unit_ct` (per its definition)
// — the grant has no decrement timer, matching the "always-on while
// equipped" semantic.

import { itemId, statusTypeId, type AccessoryEquipment } from '@engine/index.ts';

export const bootsOfHaste: AccessoryEquipment = {
  id: itemId('boots_of_haste'),
  name: 'Boots of Haste',
  kind: 'accessory',
  statusGrants: [statusTypeId('haste')],
};
