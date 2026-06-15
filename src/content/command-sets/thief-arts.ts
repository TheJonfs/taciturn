// Thievery — the Thief's command set (id `thief_arts`). The resource-theft kit: Steal HP
// (lifesteal weapon strike), Steal MP (net-positive MP drain — the refuel
// valve that funds the kit), Steal Buffs (strip the target's buffs and wear
// them), and Steal Heart (the 24-MP charm capstone).
//
// The weapon basic Attack comes from the class's freeAbilities, not here
// (the battle-skill convention — avoids duplicating Attack in the picker).
// The free Attack doubles as the MP-conservation filler, made tempo-positive
// by the innate Momentum support.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const thiefArts: CommandSetDefinition = {
  id: commandSetId('thief_arts'),
  name: 'Thievery',
  members: [
    abilityId('steal_hp'),
    abilityId('steal_mp'),
    abilityId('steal_buffs'),
    abilityId('steal_heart'),
  ],
  baseCost: 1,
  availability: 'available',
};
