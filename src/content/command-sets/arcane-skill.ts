// Arcane Skill — placeholder charged-spell command set. Holds the
// session 15 throwaway Bolt; expands into a real Mage class repertoire
// in sessions 16+ as Earth / Water / Fire / Lightning Mage abilities
// land in their dedicated command sets.
//
// The command set exists today so Bolt is reachable through an active
// bucket; the throwaway demo battle wires it onto a Knight's
// `second_action` slot (no Mage class yet). When Mage classes ship,
// each spell school gets its own command set (`earth_spells`,
// `water_spells`, etc.) and this throwaway set retires.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const arcaneSkill: CommandSetDefinition = {
  id: commandSetId('arcane_skill'),
  name: 'Arcane Skill',
  members: [abilityId('bolt')],
  baseCost: 1,
};
