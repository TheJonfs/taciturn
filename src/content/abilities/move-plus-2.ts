// Move +2 — the Thief's Movement passive. +2 to moveRange via the same
// `modifyStatQuery` chain as Move +1. Base Move 3 → 5 on the Thief.
//
// Cost 2 (Move +1 is cost 1): the stronger tier of the canonical FFT
// movement bump. The reach is load-bearing for the kit (concept-notes) —
// it's what lets the melee Steal MP / Steal HP cross the field to a
// protected backline caster in one turn.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const movePlus2: PassiveAbilityDefinition = {
  id: abilityId('move_plus_2'),
  name: 'Move +2',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) =>
      args.statName === 'moveRange' ? args.baseValue + 2 : args.baseValue,
    ),
  ],
};
