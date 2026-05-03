// Knight — placeholder stub used to verify the catalog loader end-to-end.
// Real class content (command sets, bucket capacities, stat baselines,
// movement profile) arrives with the ability-slots, ruleset, and
// class-catalog expansion sessions.

import { classId, type ClassDefinition } from '@engine/index.ts';

export const knight: ClassDefinition = {
  id: classId('knight'),
  name: 'Knight',
};
