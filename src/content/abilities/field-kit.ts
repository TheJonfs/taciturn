// Travel Preparations — Alchemist Support (Session 39b).
//
// Unit begins battle with a stockpile of one each: Potion, Phoenix
// Down, Remedy. Per the S39 brief: free on Alchemist primary; cost 1
// for cross-class equippers (D8 confirmation).
//
// The grant is declarative via `stockpileGrants` on the passive
// ability shape — `createInitialState` reads this from each unit's
// equipped passives and merges the counts into `unit.stockpile` at
// construction time. No runtime hook needed; no action-log entry
// (the stockpile is initial state, not a battle event). Cross-class
// equippers receive the same grant — the engine doesn't gate on
// class.
//
// Ether is intentionally NOT in the starting kit — the player has to
// Compound it on demand. Keeps the Alchemist's opening turn
// meaningful (Compound Ether for a teammate vs. throw the kit)
// rather than front-loading every resource.
//
// Note: the ability id stays `'field_kit'` (history / save-state
// compatibility); only the display name changed in the S39b polish
// pass per Chris's call.

import {
  abilityId,
  bucketId,
  itemId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const fieldKit: PassiveAbilityDefinition = {
  id: abilityId('field_kit'),
  name: 'Travel Preparations',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [],
  stockpileGrants: [
    { itemId: itemId('potion'), count: 1 },
    { itemId: itemId('phoenix_down'), count: 1 },
    { itemId: itemId('remedy'), count: 1 },
  ],
};
