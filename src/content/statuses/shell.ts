// Shell — additive magical resistance buff.
//
// Per Session 29 (ADR-0061 sibling): Shell registers a `modifyResistance`
// handler that adds its magnitude to the unit's magical resistance when
// the damage's tag includes `'magical'`. Default magnitude 50, meaning
// +50% magical resistance ((100 − 50) / 100 = 0.5× incoming magical
// damage) on top of native resistance.
//
// Duration: `permanent_per_unit_ct` — Shell does not auto-expire. v1's
// only consumer is Sorcerer's Robe's Auto-Shell (per the equipment doc),
// which lasts as long as the equipment is worn.
//
// A future cast-Shell spell will want a timed variant — six ticks per
// Chris's call this session, REFRESH stacking, magnitude 50 default. When
// it ships, author it as a sibling `shell_cast` status type with
// `durationMode: 'per_unit_ct'` rather than retroactively re-typing this
// one (same pattern Haste / `quickening` will follow). With both active,
// `composeResistance`'s signedMax composition takes the larger of the
// two magnitudes — cast Shell at magnitude > 50 supersedes Auto-Shell
// for the duration; expiry falls back to Auto-Shell's +50.
//
// Resistance tag: none. Application is unresisted in v1 — Sorcerer's
// Robe's grant lands at battle start regardless of the wearer's
// resistance map.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const shell: StatusEffectType = {
  id: statusTypeId('shell'),
  name: 'Shell',
  tags: ['positive', 'dispellable'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyResistance', (args, ctx) => {
      if (args.tag !== 'magical') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 0;
      return args.baseValue + magnitude;
    }),
  ],
};
