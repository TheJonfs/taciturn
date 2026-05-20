// Bravestrider — Knight's Movement passive (S41 replacement for Move +1
// in the Knight kit).
//
// Two `modifyStatQuery` chain contributions:
//   1. +1 to moveRange (parity with `move_plus_1` / Bedrock Stride / Hotfoot).
//   2. +10 to brave. Brave shifts Counter's Brave-roll trigger
//      probability (Knight at base 70 → 80, so Counter triggers ~80% vs
//      ~70%) and Brave-and-MA status applications like Stasis Sword's
//      Stop infliction. Pairs naturally with the Knight's existing
//      Reaction and Battle Skill kit without forcing a coupling.
//
// Cost-2 in v1: aligned with Bedrock Stride and Hotfoot — the
// stat-bump-on-two-axes Movement shape. Single-effect Movement
// passives (Move +1, Tidewalker, Quickstep) land at cost 1; dual-effect
// Movement passives at cost 2.
//
// Free on Knight; cross-class costs 2 of the 3 Movement capacity.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const bravestrider: PassiveAbilityDefinition = {
  id: abilityId('bravestrider'),
  name: 'Bravestrider',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'moveRange') return args.baseValue + 1;
      if (args.statName === 'brave') return args.baseValue + 10;
      return args.baseValue;
    }),
  ],
};
