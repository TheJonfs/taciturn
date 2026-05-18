// Alchemy — Alchemist's signature command set (Session 39b).
//
// Contains the two Alchemist player actions: Compound (build the
// stockpile, MP gated per item) and Throw Item (spend a stockpile
// entry on a target). Universal Attack is exposed via `freeAbilities`
// on the class — peer with Alchemy in the Act picker, per the Knight
// / Battle Skill pattern (S25's "Attack and Battle Skill as peers").

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const alchemy: CommandSetDefinition = {
  id: commandSetId('alchemy'),
  name: 'Alchemy',
  members: [abilityId('compound'), abilityId('throw_item')],
  baseCost: 1,
  availability: 'available',
};
