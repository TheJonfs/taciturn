// Potion — Session 39a Alchemist consumable. Compound for MP 8 to bank
// one; Throw at any unit to restore PA × 12 HP (capped at maxHp). On a
// KO'd target the heal is gated to 0 — Phoenix Down is the revival
// path, Potion is the bulk healer.

import { itemId, type ConsumableDefinition } from '@engine/index.ts';

export const potion: ConsumableDefinition = {
  id: itemId('potion'),
  name: 'Potion',
  kind: 'consumable',
  availability: 'available',
  compoundMpCost: 8,
  effects: {
    hpRestore: { coefficient: 12 },
  },
};
