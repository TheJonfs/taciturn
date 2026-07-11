// Speed Up — additive flat +1 Speed per application, no expiration.
//
// The positive mirror of Speed Down (Brine's debuff): Shadowblade's
// on-hit proc applies this to the WIELDER while landing Speed Down on
// the victim — the knife's identity is the widening tempo gap, and the
// Ch3-brief ruling is that BOTH directions stack permanently. Authored
// as Speed Save's exact accumulator pattern (STACK_ADDITIVE onto one
// instance's magnitude) rather than Speed Down's STACK_INDEPENDENT pile
// — one badge with a running +N reads better on the wielder.
//
// Positive polarity: Remedy never touches it; a Thief's Steal Buffs can
// lift it (buff-economy loop) — stolen tempo is a legitimate heist.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const speedUp: StatusEffectType = {
  id: statusTypeId('speed_up'),
  name: 'Speed Up',
  tags: ['positive', 'time'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'spd') return args.baseValue;
      return args.baseValue + (ctx.instance.magnitude ?? 1);
    }),
  ],
};
