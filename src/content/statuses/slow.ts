// Slow — the timed Speed debuff applied by the Hunter's Pin Down
// (Session 45). The multiplicative inverse of Haste: a `modifyStatQuery`
// on `'spd'` that scales Speed by the instance magnitude (0.5 = half
// Speed → CT accrues at half rate). Haste is ×1.5; Slow is ×0.5, the
// canonical FFT pair.
//
// Duration: `per_unit_ct` (timed, like Blind / Stop) — Pin Down supplies
// the 4-turn window. A classic timed ailment, so it stays Remedy-curable
// (NOT `remedyImmune`, unlike the flat stat-reduction debuffs per
// ADR-0081) and clears at KO per ADR-0079's per-unit-CT rule.
//
// Distinct from `speed_down` (the Water Mage's flat, permanent, additive
// −N Speed): Slow is a big, temporary, multiplicative cut — a tempo
// swing, not a committed stat erosion.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const slow: StatusEffectType = {
  id: statusTypeId('slow'),
  name: 'Slow',
  tags: ['negative', 'time'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 0.5,
  aiHints: { polarity: 'debuff', value: 25 },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'spd') return args.baseValue;
      const multiplier = ctx.instance.magnitude ?? 1;
      return args.baseValue * multiplier;
    }),
  ],
};
