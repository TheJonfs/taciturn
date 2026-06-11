// Templar Arts — the Templar's command set (S62). The hybrid White Mage +
// Dragoon kit: Cure (AoE heal), Raise (spell revive), Jump (off-field leap).
// The weapon basic Attack comes from the class's freeAbilities, not here
// (the battle-skill convention — avoids duplicating Attack in the picker).
//
// One of the Templar's two donor targets: another class raids this set for
// the healing (and, with a Lance, the Jump damage ceiling — the concept-
// notes' "Knight + Lance + Jump" watch-item). The other donor is the innate
// Monkeygrip passive.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const templarArts: CommandSetDefinition = {
  id: commandSetId('templar_arts'),
  name: 'Templar Arts',
  members: [abilityId('cure'), abilityId('raise'), abilityId('jump')],
  baseCost: 1,
  availability: 'available',
};
