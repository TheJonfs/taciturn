// Move +1 — the canonical Movement-bucket passive. +1 to moveRange.
// Routes through the existing `modifyStatQuery` chain (session 4 added
// 'moveRange' and 'jump' to StatName), the same hook Haste uses for
// Speed. Cost-1 in v1: cheap and ubiquitous.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const movePlus1: PassiveAbilityDefinition = {
  id: abilityId('move_plus_1'),
  name: 'Move +1',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) =>
      args.statName === 'moveRange' ? args.baseValue + 1 : args.baseValue,
    ),
  ],
};
