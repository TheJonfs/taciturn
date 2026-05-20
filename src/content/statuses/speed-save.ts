// Speed Save — the accumulating Speed buff granted by the Assassin's
// Speed Save Reaction (Session 42). Each time the Assassin is hit by an
// enemy for damage, the reaction applies +1 here; STACK_ADDITIVE sums
// every application onto a single instance (PA Up's pattern), so the
// magnitude is the running "+N Speed" counter — clean single-instance
// state rather than a pile of stacks.
//
// Permanent (in-battle), positive polarity. Per ADR-0079 the permanent
// (null) duration persists through KO — a revived Assassin keeps the
// Speed it earned. Positive polarity means Remedy (which clears non-buff
// statuses) never touches it.
//
// Hooks: modifyStatQuery for `'spd'` — adds `magnitude` to baseValue.
// computeSpeed floors the composed result, so the +N is a clean integer
// bump to the CT accumulation rate.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const speedSave: StatusEffectType = {
  id: statusTypeId('speed_save'),
  name: 'Speed Save',
  tags: ['positive', 'time'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'spd') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
