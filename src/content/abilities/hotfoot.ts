// Hotfoot — Fire Mage's class-free Movement passive.
//
// Two `modifyStatQuery` chain contributions:
//   1. +1 to moveRange (parity with `move_plus_1` / Bedrock Stride).
//   2. +1 to spd. Speed bumps compound through CT regen so the fire mage
//      hits earlier in the queue; combined with Aether-Bloom-enlarged
//      Fire Storm this lets Fire press the tempo advantage that fits
//      its "ignite the field and don't get caught flat-footed" identity.
//
// Per ADR-0006: Speed mods compose multiplicatively for ×factor handlers
// and additively for +N handlers. Hotfoot's +1 is additive; it stacks
// linearly with Haste's ×1.5 and any other +N source.
//
// Cost-2 in v1: aligned with Bedrock Stride. The stat-bump-on-two-axes
// shape is universally useful, so its cost matches the dual-effect tier.

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const hotfoot: PassiveAbilityDefinition = {
  id: abilityId('hotfoot'),
  name: 'Hotfoot',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 2,
  availability: 'available',
  tags: ['fire'],
  hooks: [
    passiveHook('modifyStatQuery', (args) => {
      if (args.statName === 'moveRange') return args.baseValue + 1;
      if (args.statName === 'spd') return args.baseValue + 1;
      return args.baseValue;
    }),
  ],
};
