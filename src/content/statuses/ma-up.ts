// MA Up — additive flat +MA per stack, permanent for the battle.
//
// Mirror of PA Up; see pa-up.ts for the design rationale.
//
// Hooks: modifyStatQuery for `'ma'` — adds `magnitude` to baseValue.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const maUp: StatusEffectType = {
  id: statusTypeId('ma_up'),
  name: 'MA Up',
  tags: ['positive'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'ma') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
