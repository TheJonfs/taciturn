// Battle Skill — Knight's signature command set. Session 17c
// expanded the v1 set from `attack` to include Power Attack, Stasis
// Sword, and Taunt — all First Action members on the same set, so a
// player whose Knight has Battle Skill equipped can pick any of them
// from the action menu when their First Action fires. The broader
// sword-tech repertoire (Hero Sword, Break, etc.) lands with later
// Knight content passes.
//
// Session 25 (Attack-in-Act refit): the universal `attack` ability
// is surfaced via the class's `freeAbilities` and renders as a peer
// of the command sets in the Act picker — so Knight sees "Attack,
// Battle Skill" rather than seeing Attack twice (once at the picker
// level, once inside Battle Skill's members). Removing `attack` from
// `members` keeps it a single-source-of-truth picker entry.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const battleSkill: CommandSetDefinition = {
  id: commandSetId('battle_skill'),
  name: 'Battle Skill',
  members: [
    abilityId('power_attack'),
    abilityId('stasis_sword'),
    abilityId('taunt'),
  ],
  baseCost: 1,
  availability: 'available',
};
