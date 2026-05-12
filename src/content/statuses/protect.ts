// Protect — additive physical resistance buff.
//
// Mirror of Shell (per Session 29): registers a `modifyResistance` handler
// that adds its magnitude to the unit's physical resistance when the
// damage's tag includes `'physical'`. Default magnitude 50, meaning +50%
// physical resistance ((100 − 50) / 100 = 0.5× incoming physical damage).
//
// Duration: `permanent_per_unit_ct` — Protect does not auto-expire. v1
// ships no consumer (Auto-Protect is reserved for future Knight-side
// armor in Equipment Batch B-or-later); the status is authored now so
// the substrate is in place when content arrives. A future cast-Protect
// spell follows the same `protect_cast` (per_unit_ct, 6-tick default,
// REFRESH) pattern as Shell.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const protect: StatusEffectType = {
  id: statusTypeId('protect'),
  name: 'Protect',
  tags: ['positive', 'dispellable'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      if (args.tag !== 'physical') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 0;
      return args.baseValue + magnitude;
    }),
  ],
};
