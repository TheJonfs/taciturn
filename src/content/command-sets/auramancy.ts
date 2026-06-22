// Auramancy — the Enchanter's command set (S72). The dedicated
// ally-enhancement suite: Haste / Protect / Shell (chance-based AoE buffs,
// tuned ~90% on a default-Faith ally) and Esuna (100% AoE cleanse). Support-
// only by design — the Enchanter's offense rides a *secondary* command set,
// and Auramancy-as-secondary hands any class a portable buff kit.
//
// The weapon basic Attack comes from the class's freeAbilities, not here
// (the battle-skill convention — avoids duplicating Attack in the picker).

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const auramancy: CommandSetDefinition = {
  id: commandSetId('auramancy'),
  name: 'Auramancy',
  members: [
    abilityId('enchant_haste'),
    abilityId('enchant_protect'),
    abilityId('enchant_shell'),
    abilityId('esuna'),
  ],
  baseCost: 1,
  availability: 'available',
};
