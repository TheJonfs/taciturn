// PA Up — additive flat +PA per stack, permanent for the battle.
//
// Per session 19 plaintext review: direct stat shifts persist for the
// remainder of the battle (no expiration timer). STACK_ADDITIVE means
// magnitudes sum across applications onto a single instance — three
// casts each granting +1 PA combine into one instance with magnitude 3.
// Net-zero composition with PA Down (the inverse status with the same
// shape) lets a buff and a debuff cleanly cancel.
//
// Hooks: modifyStatQuery for `'pa'` — adds `magnitude` to baseValue.
// No floor enforced here; the BMG stat caps clamp PA to [1, 99] at the
// query layer.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const paUp: StatusEffectType = {
  id: statusTypeId('pa_up'),
  name: 'PA Up',
  tags: ['positive'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'pa') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
