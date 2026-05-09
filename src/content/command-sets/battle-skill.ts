// Battle Skill — Knight's signature command set. Session 17c
// expanded the v1 set from `attack` to include Power Attack, Stasis
// Sword, and Taunt — all First Action members on the same set, so a
// player whose Knight has Battle Skill equipped can pick any of them
// from the action menu when their First Action fires. The broader
// sword-tech repertoire (Hero Sword, Break, etc.) lands with later
// Knight content passes.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const battleSkill: CommandSetDefinition = {
  id: commandSetId('battle_skill'),
  name: 'Battle Skill',
  members: [
    abilityId('attack'),
    abilityId('power_attack'),
    abilityId('stasis_sword'),
    abilityId('taunt'),
  ],
  baseCost: 1,
};
