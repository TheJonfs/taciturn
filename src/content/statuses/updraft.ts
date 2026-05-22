// Updraft — the accumulating Jump buff granted by the Hunter's Updraft
// Reaction (Session 45). The Jump-axis twin of Speed Save: each time the
// Hunter is hit by an enemy for damage, the reaction applies +1 here;
// STACK_ADDITIVE sums every application onto a single instance, so the
// magnitude is the running "+N Jump" counter. Thematically: getting
// knocked around teaches the Hunter to take the high ground.
//
// Permanent (in-battle), positive polarity → persists through KO
// (ADR-0079) and Remedy never clears it. Hook: `modifyStatQuery` for
// `'jump'`, adding `magnitude` to the base.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const updraft: StatusEffectType = {
  id: statusTypeId('updraft'),
  name: 'Updraft',
  tags: ['positive', 'time'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'jump') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
