// Expert Former — the Terraformer's native Support passive (Session 54).
// Free and native on the Terraformer; cross-class costs 1.
//
// Raises the Worldcraft active-effect cap by +2 (base 2 → 4) via
// `modifyStatQuery('worldcraft_effect_cap')`. The cap is read computed
// (not stored) on every enqueue, so equipping / unequipping changes it live.
// Silently implicit: it affects only Worldcraft-cast effects, so on a class
// without Worldcraft access (primary or secondary) it does nothing.
//
// Cost tier: 1 SP — useless without Worldcraft access, so priced low. A
// cross-class user who equips Worldcraft as a secondary command set + Expert
// Former gets the full 4-effect cap (a build worth watching — see
// playtest-watch).

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const EXPERT_FORMER_CAP_BONUS = 2;

export const expertFormer: PassiveAbilityDefinition = {
  id: abilityId('expert_former'),
  name: 'Expert Former',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'worldcraft_effect_cap') return args.baseValue + EXPERT_FORMER_CAP_BONUS;
      return args.baseValue;
    }),
  ],
};
