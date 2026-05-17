// Phoenix Down — Session 39a Alchemist consumable. Compound for MP 12
// to bank one; Throw at a KO'd unit to revive (HP=1 baseline) and
// restore PA × 4 HP on top of the revive. On a non-KO'd target the
// revive is a no-op and the heal still applies. Resets the target's
// permadeath counter (`turnsKOd`) to 0.

import { itemId, type ConsumableDefinition } from '@engine/index.ts';

export const phoenixDown: ConsumableDefinition = {
  id: itemId('phoenix_down'),
  name: 'Phoenix Down',
  kind: 'consumable',
  availability: 'available',
  compoundMpCost: 12,
  effects: {
    removeKO: true,
    hpRestore: { coefficient: 4 },
  },
};
