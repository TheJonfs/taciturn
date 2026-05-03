// Battle Skill — Knight's signature command set. v1 contains just
// `attack`; the broader sword-tech repertoire (Hero Sword, Stasis
// Sword, etc.) lands with the ability-content expansion pass.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const battleSkill: CommandSetDefinition = {
  id: commandSetId('battle_skill'),
  name: 'Battle Skill',
  members: [abilityId('attack')],
  baseCost: 1,
};
