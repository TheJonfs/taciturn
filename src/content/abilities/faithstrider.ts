// Faithstrider — the Templar's Movement passive (S62, Templar arc).
//
// Two `modifyStatQuery` chain contributions (the dual-axis Movement shape,
// mirroring Bravestrider):
//   1. +1 to moveRange — lifts the Templar from base Move 2 → 3, the
//      slow-caster tier's sanctioned lift (no base-4, per the Move-tier
//      principle).
//   2. +10 to faith — raises the Templar's own healing and revive output
//      (Cure/Raise scale on `computeFaithFactor`, the symmetric
//      caster×target faith product), at the cost of more vulnerability to
//      enemy magic: faith cuts both ways in that same product, so a
//      higher-faith Templar both heals harder and takes more magical
//      damage.
//
// Cost-2 in v1: aligned with Bravestrider — the stat-bump-on-two-axes
// Movement shape. Single-effect Movement passives (Move +1, High Jump,
// Tidewalker, Quickstep) land at cost 1; dual-effect at cost 2.
//
// Free on the Templar; cross-class costs 2 of the 3 Movement capacity.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const faithstrider: PassiveAbilityDefinition = {
  id: abilityId('faithstrider'),
  name: 'Faithstrider',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'moveRange') return args.baseValue + 1;
      if (args.statName === 'faith') return args.baseValue + 10;
      return args.baseValue;
    }),
  ],
};
