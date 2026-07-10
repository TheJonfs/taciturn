// Trident — TABA Ch3 Templar lance (M3 equipment expansion). WP 13,
// accuracy 90, the full Lance package (2H, reach 2/4, pierce, [0.9,
// 1.1] band), plus +5 action speed on Templar Arts casts.
//
// The class-command-scoped action-speed rider (the lineup's Trident
// confirm): Livre of Urgency's damage-type-scoped rider was the
// precedent; the `commandSetFilter` gate is the command-set-membership
// variant — only abilities that are members of `templar_arts` charge
// faster. Any class can WIELD it (weapons are universal), but only a
// unit casting Templar Arts collects the rider.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { commandSetId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const trident: WeaponEquipment = {
  id: itemId('trident'),
  name: 'Trident',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'polearm',
  wp: 13,
  accuracy: 90,
  tags: ['lance'],
  twoHanded: true,
  range: { min: 1, max: 2, vertical: 4 },
  pierces: true,
  physicalVariance: { kind: 'static', min: 0.9, max: 1.1 },
  actionSpeedModifiers: [{ delta: 5, commandSetFilter: commandSetId('templar_arts') }],
};
