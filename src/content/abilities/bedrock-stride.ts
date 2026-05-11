// Bedrock Stride — Earth Mage's class-free Movement passive.
//
// Two effects through the existing hook surface:
//   1. `modifyStatQuery` +1 to moveRange. Same pattern as `move_plus_1`.
//   2. `modifySystemDamage` returns 0 when the incoming `system_damage`
//      action's `source.kind === 'falling'`. First v1 consumer of the
//      hook added in ADR-0052 (session 26); the source-discriminant gate
//      keeps Poison ticks and `ability_self_cost` damage unaffected.
//
// Earth's identity is "the slow weighty force that grounds itself" —
// extra Move range nudges Earth Mage toward a slightly more mobile
// stance than the bare 3/3 baseline, and immunity to falling damage
// makes elevation-driven knockbacks (Tide Surge, Knight push) a
// non-threat the way Float makes water non-threatening.
//
// Cost-2 in v1: meaningfully expensive (most Mage class-free passives
// land at 2), pays for both the stat bump and the fall-damage immunity.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const bedrockStride: PassiveAbilityDefinition = {
  id: abilityId('bedrock_stride'),
  name: 'Bedrock Stride',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  tags: ['earth'],
  hooks: [
    passiveHook('modifyStatQuery', (args) =>
      args.statName === 'moveRange' ? args.baseValue + 1 : args.baseValue,
    ),
    passiveHook('modifySystemDamage', (args) =>
      args.source.kind === 'falling' ? 0 : args.baseAmount,
    ),
  ],
};
