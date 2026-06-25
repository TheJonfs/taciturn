// Haste — the canonical session-3 demo status. Its only handler is a
// `modifyStatQuery` that multiplies Speed by the instance's magnitude
// when the queried stat is `'spd'`. That single hook end-to-end exercises
// the catalog, the apply pipeline, the active-handler collector, and the
// computeSpeed integration.
//
// Magnitude semantics: 1.5 means "150% of base Speed." The default
// magnitude for the catalog stub is 1.5, matching FFT convention.
//
// Duration: `permanent_per_unit_ct` — Haste does not auto-expire. v1's
// only consumer is the Boots of Haste equipment grant (per ADR-0028),
// which intentionally lasts as long as the equipment is worn. When a
// timed-Haste ability lands later, the right shape is a separate
// status type (e.g., `quickening`) with a duration-counted mode rather
// than retroactively re-typing this one.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
  type StatusHookRegistration,
} from '@engine/index.ts';

// The Haste behavior — Speed × magnitude — lives here once and is shared by
// the equipment-grant `haste` (permanent) and the cast `quickening` (timed)
// siblings, so "Haste behaves the same regardless of source" holds by
// construction (the regen / regen_auto pattern). The two types differ only in
// id, durationMode, and (eventually) the amplifiable flag.
export const hasteSpeedHook: StatusHookRegistration = statusHook(
  'modifyStatQuery',
  (args, ctx) => {
    if (args.statName !== 'spd') return args.baseValue;
    const multiplier = ctx.instance.magnitude ?? 1;
    return args.baseValue * multiplier;
  },
);

export const haste: StatusEffectType = {
  id: statusTypeId('haste'),
  name: 'Haste',
  tags: ['positive', 'time', 'dispellable'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'haste',
  defaultMagnitude: 1.5,
  aiHints: { polarity: 'buff' },
  hooks: [hasteSpeedHook],
};
