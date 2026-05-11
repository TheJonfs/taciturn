// Float — Movement-bucket passive that adds 'water' to canEnter.
// Demonstrates the structural-modifier hook surface (`modifyCanEnter`)
// added in session 5. The handler returns a *new* set rather than
// mutating the input — composition is functional, like every other
// chain hook.
//
// Cost-2 in v1: situationally crucial (water-heavy maps), niche
// elsewhere.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const float: PassiveAbilityDefinition = {
  id: abilityId('float'),
  name: 'Float',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'hidden',
  hooks: [
    passiveHook('modifyCanEnter', (args) => new Set([...args.baseValue, 'water'])),
  ],
};
