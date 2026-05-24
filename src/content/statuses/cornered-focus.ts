// Cornered Focus — the accumulating MA buff granted by the Calculator's
// Cornered Focus Reaction (Session 49). Each time the Calculator is hit
// by an enemy for damage, the reaction applies +1 here; STACK_ADDITIVE
// sums every application onto a single instance (Speed Save / Updraft
// pattern), so the magnitude is the running "+N MA" counter — clean
// single-instance state rather than a pile of stacks.
//
// Permanent (in-battle), positive polarity. Per ADR-0079 the permanent
// (null) duration persists through KO — a revived Calculator keeps the
// MA they earned. Positive polarity means Remedy never touches it.
//
// Hooks: modifyStatQuery for `'ma'` — adds `magnitude` to baseValue.
// Math Skill damage / heal / CT effects all read MA through this chain,
// so each Cornered Focus stack lifts the Calculator's output across the
// entire Math command set.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const corneredFocus: StatusEffectType = {
  id: statusTypeId('cornered_focus'),
  name: 'Cornered Focus',
  tags: ['positive', 'mental'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'ma') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
