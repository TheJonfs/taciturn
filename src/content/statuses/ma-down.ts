// MA Down — additive flat -MA per stack, permanent for the battle.
//
// Mirror of PA Down; see pa-down.ts for the design rationale. Resistance
// tag 'fire' (Fire Strike applier).
//
// Hooks: modifyStatQuery for `'ma'` — subtracts `magnitude` from baseValue,
// floored at 1 per BMG stat caps.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const maDown: StatusEffectType = {
  id: statusTypeId('ma_down'),
  name: 'MA Down',
  tags: ['negative', 'fire'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  aiHints: { polarity: 'debuff', value: 15 },
  defaultMagnitude: 1,
  // Stat-reduction debuff — not Remedy-clearable (Session 42 convention).
  remedyImmune: true,
  resistanceTag: 'fire',
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'ma') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return Math.max(1, args.baseValue - magnitude);
    }),
  ],
};
