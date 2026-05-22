// Riptide Bow — the Hunter's water-flavored bow (Session 45). Trades raw
// power for tempo control: lower WP than the Longbow, but a chance to
// push the target's turn back on every hit.
//
// WP 5 / Acc 33, the same 2-5 / vertical-99 range and height-delta
// variance as the Longbow, two-handed. The identity is the on-hit proc:
// 30% chance to fire Undertow (a PA-scaled `system_ct_push`, ~18 CT back
// for a Hunter), mechanically symmetric to the Water Mage's CT
// manipulation. Flat-percentage proc gate per the equipment doc (weapon
// riders decouple from the wielder's casting prowess).
//
// Tags include 'water' for the elemental flavor (and future anti-water /
// resistance interactions); 'bow' for the weapon class.

import { abilityId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const riptideBow: WeaponEquipment = {
  id: itemId('riptide_bow'),
  name: 'Riptide Bow',
  availability: 'available',
  kind: 'weapon',
  wp: 5,
  accuracy: 33,
  tags: ['bow', 'water'],
  twoHanded: true,
  range: { min: 2, max: 5, vertical: 99 },
  physicalVariance: { kind: 'height_delta', falloffPerHeight: 0.2 },
  attackProcs: [{ chance: 0.3, abilityId: abilityId('undertow') }],
};
