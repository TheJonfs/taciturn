// Speed Down (Water) — additive flat -1 Speed per stack, no expiration.
//
// Per session 18 plaintext review: each application of Brine creates an
// independent stack via STACK_INDEPENDENT — two casts on the same target
// yields -2 Speed via two separate instances. Permanent (in-battle) until
// cleared by an explicit removal ability/item.
//
// Hooks: modifyStatQuery for `'spd'` — subtracts 1 (or `magnitude`) from
// baseValue. The ruleset's Speed floor catches negative composition; this
// status doesn't enforce a per-instance floor.
//
// Resistance tag: 'water' — leaving room for future tuning (no v1 unit
// has water resistance set, so resistance is a no-op today).

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const speedDown: StatusEffectType = {
  id: statusTypeId('speed_down'),
  name: 'Speed Down',
  tags: ['negative', 'water'],
  durationMode: 'permanent',
  stackingRule: 'STACK_INDEPENDENT',
  defaultMagnitude: 1,
  // Stat-reduction debuff — not Remedy-clearable (Session 42 convention).
  remedyImmune: true,
  resistanceTag: 'water',
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'spd') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue - magnitude;
    }),
  ],
};
