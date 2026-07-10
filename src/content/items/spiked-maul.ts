// Spiked Maul — TABA Ch3 brute axe (M3 equipment expansion). WP 20 —
// the highest weapon power in the game — accuracy 75, axe variance;
// cost: Reaction bucket capacity −3, i.e. the baseline-3 reaction
// bucket drops to ZERO while wielding.
//
// Chris's ruling (the register's cost question, sharpened): keep WP 20
// and take the whole reaction bucket — the wielder equips NO reaction
// passives at all. Two wrinkles flagged at ship time (handoff):
//  1. Capacity 0 blocks class-NATIVE reactions too (they occupy the
//     bucket like any equipped passive) — stronger than "only their
//     innate reaction survives." If innate-survives is wanted, that
//     needs a different mechanism.
//  2. `createInitialState` THROWS on over-capacity loadouts, and the M2
//     Formation UI assumes equipment only LIFTS capacity — the M3 gear
//     UI must enforce equipment-adjusted capacity (unequip-excess or
//     block) before players can equip this.
//
// TABA-only: `hidden` + campaign pool (chapter 3, shop).

import { bucketId, itemId, type WeaponEquipment } from '@engine/index.ts';

export const spikedMaul: WeaponEquipment = {
  id: itemId('spiked_maul'),
  name: 'Spiked Maul',
  availability: 'hidden',
  kind: 'weapon',
  weaponType: 'axe',
  wp: 20,
  accuracy: 75,
  tags: ['axe'],
  physicalVariance: { kind: 'static', min: 0.9, max: 1.3 },
  bucketCapacityMods: new Map([[bucketId('reaction'), -3]]),
};
