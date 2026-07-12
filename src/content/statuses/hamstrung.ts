// Hamstrung — Sera's Hamstring debuff (TABA chapter-1 plot unit).
//
// A STACKING, PERMANENT anti-mobility grind: each application reduces the
// target's Move Range AND Jump by 1 more, each floored at 0 independently.
// A different anti-mobility axis than Shadow Stitch's short-duration total Stop
// — attritional grind-down vs. burst lockdown. Accumulating to a FULL immobilize
// (Move 0 AND Jump 0) takes several dedicated turns → a boss-fight texture, not
// a dominant strategy.
//
// Config mirrors Combat Focus (permanent + STACK_ADDITIVE): each apply adds +1
// to the single instance's `magnitude` (defaultMagnitude 1). The modifyStatQuery
// hook subtracts that magnitude from `moveRange` and `jump`, `Math.max(0, …)`
// flooring EACH stat on its own — so "immobilized" is only true when BOTH floor
// (a target at Move 0 / Jump 2 can still climb / be repositioned).

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const hamstrung: StatusEffectType = {
  id: statusTypeId('hamstrung'),
  name: 'Hamstrung',
  tags: ['negative'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  aiHints: { polarity: 'debuff', value: 15 },
  defaultMagnitude: 1,
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'moveRange' && args.statName !== 'jump') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return Math.max(0, args.baseValue - magnitude);
    }),
  ],
};
