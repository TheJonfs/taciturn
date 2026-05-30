// Ignore Height — the Terraformer's native Movement passive (Session 54).
// Free and native on the Terraformer; cross-class costs 3.
//
// Removes the Jump-stat constraint on vertical movement: the wearer can step
// between any two adjacent tiles regardless of elevation delta. Implemented
// as a `modifyStatQuery('jump')` override returning a large value (99 — the
// same "effectively infinite" sentinel the magic abilities use for vertical
// range), so the movement profile's jump check never blocks.
//
// Cost tier: 3 SP. The most expensive Movement passive in v1 — a strong
// mobility upgrade for ANY class that equips it (a cross-class Ignore-Height
// Knight becomes a mobility menace), priced to reflect that cross-class value
// rather than the Terraformer's own modest mobility needs.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const IGNORE_HEIGHT_JUMP = 99;

export const ignoreHeight: PassiveAbilityDefinition = {
  id: abilityId('ignore_height'),
  name: 'Ignore Height',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 3,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'jump') return Math.max(args.baseValue, IGNORE_HEIGHT_JUMP);
      return args.baseValue;
    }),
  ],
};
