// Ether — Session 39a Alchemist consumable. Compound for MP 10 to bank
// one; Throw at any unit to restore PA × 4 MP (capped at maxMp). KO'd
// targets receive 0 (vitals are gated while KO'd, parallel to HP).
//
// First v1 MP-restore consumer. Item application invokes the
// `applyMpRestore` primitive added in Session 39a (parallel to the
// existing applyHpHeal path) — no Faith/MA scaling, no resistance, no
// reactions. Caps at maxMp from `runModifyStatQuery`.

import { itemId, type ConsumableDefinition } from '@engine/index.ts';

export const ether: ConsumableDefinition = {
  id: itemId('ether'),
  name: 'Ether',
  kind: 'consumable',
  availability: 'available',
  compoundMpCost: 10,
  effects: {
    mpRestore: { coefficient: 4 },
  },
};
