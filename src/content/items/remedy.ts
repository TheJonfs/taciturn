// Remedy — Session 39a Alchemist consumable. Compound for MP 6 to bank
// one; Throw at any unit to clear every debuff-polarity status
// (polarity defaults to 'debuff' when undeclared per the convention in
// src/ui/status-polarity.ts). Equipment-sourced statuses (Auto-Haste,
// Auto-Regen, etc.) are immune per ADR-0028 and skipped. KO isn't a
// status, so Remedy never touches it — Phoenix Down is the only KO
// removal.

import { itemId, type ConsumableDefinition } from '@engine/index.ts';

export const remedy: ConsumableDefinition = {
  id: itemId('remedy'),
  name: 'Remedy',
  kind: 'consumable',
  availability: 'available',
  compoundMpCost: 6,
  effects: {
    clearStatuses: { kind: 'debuff' },
  },
};
