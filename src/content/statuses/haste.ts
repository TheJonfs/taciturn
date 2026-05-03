// Haste — the canonical session-3 demo status. Its only handler is a
// `modifyStatQuery` that multiplies Speed by the instance's magnitude
// when the queried stat is `'spd'`. That single hook end-to-end exercises
// the catalog, the apply pipeline, the active-handler collector, and the
// computeSpeed integration.
//
// Magnitude semantics: 1.5 means "150% of base Speed." The default
// magnitude for the catalog stub is 1.5, matching FFT convention.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const haste: StatusEffectType = {
  id: statusTypeId('haste'),
  name: 'Haste',
  tags: ['positive', 'time', 'dispellable'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 1.5,
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'spd') return args.baseValue;
      const multiplier = ctx.instance.magnitude ?? 1;
      return args.baseValue * multiplier;
    }),
  ],
};
