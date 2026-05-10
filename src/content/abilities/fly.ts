// Fly — Movement-bucket passive that flips the unit's special movement
// to 'fly'. Pathfinding then uses the Fly branch (session 5): standard
// adjacency, no jump constraint, terrain costs and canEnter still
// apply. Cost-3 in v1: the premium movement option.
//
// `modifySpecialMovement`'s baseValue may be undefined (most units
// have no special movement). The handler unconditionally returns
// 'fly'; if a future ability needs to chain ("upgrade fly to teleport"),
// it inspects the baseValue and decides.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
  type SpecialMovementType,
} from '@engine/index.ts';

export const fly: PassiveAbilityDefinition = {
  id: abilityId('fly'),
  name: 'Fly',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  hooks: [
    passiveHook('modifySpecialMovement', (): SpecialMovementType => 'fly'),
  ],
};
