// High Jump — the Hunter's Movement passive (Session 45). Free and native
// on the Hunter; cross-class costs 1 (single-effect Movement tier, like
// Move +1 / Tidewalker / Quickstep — one axis, one point of the cost
// ladder).
//
// Single `modifyStatQuery` contribution: +2 jump. Takes the Hunter's
// base Jump 3 to 5 — letting the archer reach the elevated firing
// positions its height-delta variance rewards. Reach (moveRange) is
// untouched; this is pure vertical mobility.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const highJump: PassiveAbilityDefinition = {
  id: abilityId('high_jump'),
  name: 'High Jump',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'jump') return args.baseValue + 2;
      return args.baseValue;
    }),
  ],
};
