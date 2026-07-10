// Spiked Maul — TABA Ch3 brute axe (M3 equipment expansion). WP 20 —
// the highest weapon power in the game — accuracy 75, axe variance;
// cost: Reaction bucket capacity −3, i.e. the baseline-3 reaction
// bucket drops to ZERO while wielding.
//
// Chris's ruling (the register's cost question, sharpened): keep WP 20
// and take the whole reaction bucket. Because the capacity budget is
// COST-weighted and class-innate abilities cost 0 (`getCost` →
// freeAbilities), capacity 0 delivers exactly the stated intent: the
// wielder KEEPS their class-innate reaction (Counter on a Knight) and
// can import NO others. A Steel Helm partially offsets (net capacity 1
// → innate + one cost-1 import). Semantics pinned in
// taba-ch3-effect-gear.test.ts.
//
// Ship-time wrinkle (handoff): `createInitialState` THROWS on
// over-capacity loadouts, and the M2 Formation UI assumes equipment
// only LIFTS capacity — the M3 gear UI must enforce equipment-adjusted
// capacity (unequip-excess or block) before players can equip this.
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
