// White Magic — placeholder healing-and-support command set. v1 contains
// just `cure`; the broader white-magic repertoire (Cura, Raise, Esuna,
// Protect, Shell, etc.) lands with the ability-content expansion pass.
//
// Lives in `second_action` for session 13's demo loadout, so a Knight
// with white magic equipped has Attack as their First Action and Cure
// as their Second. Eventually classes like Priest will pin White Magic
// as their First Action via `firstActionCommandSet`.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const whiteMagic: CommandSetDefinition = {
  id: commandSetId('white_magic'),
  name: 'White Magic',
  members: [abilityId('cure')],
  baseCost: 1,
  // Hidden in v1 per session 25: a one-member set is too thin to surface
  // to the team builder. Re-enable once the broader white-magic repertoire
  // (Cura, Raise, Esuna, Protect, Shell, …) lands.
  availability: 'hidden',
};
