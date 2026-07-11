// Gilded Focus — additive flat +1 MA per stack, no expiration.
//
// The Golden Rod's payoff half: each start-of-turn pact tick grants one
// stack (see golden-rod-pact.ts), so the wielder's MA climbs +1/turn for
// as long as they survive the drain. Terra Attunement's exact accumulator
// pattern (STACK_ADDITIVE magnitude, permanent, modifyStatQuery on 'ma');
// only the trigger differs — turn cadence instead of earth casts.
//
// Positive polarity, no exclusivity: it composes WITH Terra Attunement
// (a Golden Rod Terraformer double-dips by design — the rod's downside
// is the balancing lever, not stack competition).

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const gildedFocus: StatusEffectType = {
  id: statusTypeId('gilded_focus'),
  name: 'Gilded Focus',
  tags: ['positive'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'ma') return args.baseValue;
      return args.baseValue + (ctx.instance.magnitude ?? 1);
    }),
  ],
};
