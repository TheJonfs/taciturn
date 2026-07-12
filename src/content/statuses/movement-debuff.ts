// Movement Debuff (Earth) — reduces target's Move Range and Jump.
//
// Per session 16 plaintext review: one status type covers both Move
// and Jump (tied together as a single -1/-1 effect), magnitude held
// at 1 with REFRESH stacking. A future session can split into
// per-stat variants if a class needs differentiated debuffs.
//
// Hooks: modifyStatQuery for `moveRange` and `jump` — both subtract
// `magnitude` from baseValue. v1 default magnitude 1 means -1 to each.
// Floor at 0 isn't enforced here (a target with moveRange 0 simply
// can't move; pathfinding handles the empty result naturally).
//
// Resistance tag: 'earth' — units with positive earth resistance
// resist application; negative earth resistance amplifies it.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const movementDebuff: StatusEffectType = {
  id: statusTypeId('movement_debuff'),
  name: 'Movement Debuff',
  tags: ['negative', 'earth'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'debuff', value: 10 },
  defaultMagnitude: 1,
  resistanceTag: 'earth',
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'moveRange' && args.statName !== 'jump') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return Math.max(0, args.baseValue - magnitude);
    }),
  ],
};
