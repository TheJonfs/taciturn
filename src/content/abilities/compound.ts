// Compound — Alchemist Command Set entry (Session 39b).
//
// UI handle for the S39a `use_compound` action. The ability shell
// here is mostly cosmetic: it names the entry in the Command Set
// picker, declares a placeholder targeting kind ('self' — Compound
// is self-targeted in the sense that it modifies the actor's
// stockpile), and carries `mpCost: 0` because items pay MP at the
// per-item Compound cost, not at the ability level.
//
// The action-menu FSM detects this ability by id (`compound`) and
// routes into the `compound-item-select` state instead of the normal
// target-select. The commit emits `use_compound` (not `use_ability`)
// with the player-picked itemId in the payload — see
// `src/ui/use-turn-flow.ts` for the routing.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const compound: ActiveAbilityDefinition = {
  id: abilityId('compound'),
  name: 'Compound',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 0,
  availability: 'available',
  targeting: { kind: 'self' },
  actionSpeed: 0,
  mpCost: 0,
  effects: {},
};
