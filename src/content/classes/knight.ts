// Knight — placeholder stub used to verify the catalog loader end-to-end
// and to seed the movement / ability-slot subsystems with a class that
// has real baselines.
// Real class content (additional command sets, R/S/M grants beyond the
// session-5 demo, level/equipment baselines) arrives with the
// ability-slots and class-catalog expansion sessions.
//
// Movement values (moveRange 3, jump 2, ground-only) match FFT's iconic
// Knight. First Action is pinned to `battle_skill`. `freeAbilities`
// includes Move +1 to demonstrate the cost-0 modulation path; players
// can still spend Movement-bucket capacity on Float / Fly etc. on top.

import {
  abilityId,
  classId,
  commandSetId,
  type ClassDefinition,
} from '@engine/index.ts';

export const knight: ClassDefinition = {
  id: classId('knight'),
  name: 'Knight',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
  firstActionCommandSet: commandSetId('battle_skill'),
  freeAbilities: new Set([abilityId('move_plus_1')]),
};
