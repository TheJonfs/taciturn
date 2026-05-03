// Knight — placeholder stub used to verify the catalog loader end-to-end
// and to seed the movement subsystem with a class that has a real
// MovementProfile baseline.
// Real class content (command sets, bucket capacities, stat baselines
// beyond movement) arrives with the ability-slots, ruleset, and
// class-catalog expansion sessions.
//
// Movement values (moveRange 3, jump 2, ground-only) match FFT's iconic
// Knight. They're tunable as content lands; v1 has no other classes
// to relativize against.

import { classId, type ClassDefinition } from '@engine/index.ts';

export const knight: ClassDefinition = {
  id: classId('knight'),
  name: 'Knight',
  movement: {
    moveRange: 3,
    jump: 2,
    terrainCosts: new Map(),
    canEnter: new Set(['ground']),
  },
};
