// PA Down — additive flat -PA per stack, permanent for the battle.
//
// Per session 19 plaintext review: the inverse of PA Up — same shape,
// opposite sign. STACK_ADDITIVE composition means a +2 PA Up plus a -1
// PA Down on the same target sum to a net +1 effect at the
// modifyStatQuery layer (composed over the two instances). Permanent
// duration: persists for the rest of the battle until explicitly cleared.
//
// Resistance tag: 'fire' — Fire Strike is the v1 applier; future
// fire-resistant units (none in v1) opt out via the BMG application
// formula's resistance term.
//
// Hooks: modifyStatQuery for `'pa'` — subtracts `magnitude` from
// baseValue. Floor at 1 (per BMG stat caps) is enforced at the
// composed-stat-query layer, not per-status.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const paDown: StatusEffectType = {
  id: statusTypeId('pa_down'),
  name: 'PA Down',
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
      if (args.statName !== 'pa') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return Math.max(1, args.baseValue - magnitude);
    }),
  ],
};
