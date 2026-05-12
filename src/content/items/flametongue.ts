// Flametongue — Fire-tagged sword. WP 6, accuracy 90.
//
// Per the equipment doc: counter-pick weapon. WP drop vs. Long Sword
// (8 → 6) is the cost; the Fire tag means physical hits compose with
// the target's Fire resistance through the elemental wheel.
//
// Burn proc rider (25% per hit) is deferred to Session 31 / Cluster 5
// — the attack_proc infrastructure ships then.

import { itemId, type WeaponEquipment } from '@engine/index.ts';

export const flametongue: WeaponEquipment = {
  id: itemId('flametongue'),
  name: 'Flametongue',
  availability: 'available',
  kind: 'weapon',
  wp: 6,
  accuracy: 90,
  tags: ['sword', 'fire'],
};
