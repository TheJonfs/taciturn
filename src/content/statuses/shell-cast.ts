// Shell (cast) — the timed form of Shell. Display name "Shell": the
// player sees "Shell" whether it came from Sorcerer's Robe's Auto-Shell
// (the permanent `shell` status, equipment lifecycle) or the Enchanter's
// Auramancy cast (this status, timed). Same `modifyResistance` handler
// (+magnitude magical resistance); the only difference from `shell` is
// `per_unit_ct` duration so the buff expires.
//
// Authored as a separate type per the steer in `shell.ts` ("author it as
// a sibling `shell_cast` status type with `durationMode: 'per_unit_ct'`
// rather than retroactively re-typing this one ... cast Shell at
// magnitude > 50 supersedes Auto-Shell for the duration; expiry falls
// back to Auto-Shell's +50"). magnitude 50 ⇒ 0.5× incoming magical,
// composed via signedMax against native resistance.
//
// Stealable (`aiHints.polarity: 'buff'`, non-equipment) for the Thief's
// Steal Buffs loop (S72). `dispellable` for future dispel content.
//
// Balance note (S72 watch-for): reliable magical damage reduction shifts
// time-to-kill — flagged for the playtest pile.

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const shellCast: StatusEffectType = {
  id: statusTypeId('shell_cast'),
  name: 'Shell',
  tags: ['positive', 'dispellable'],
  durationMode: 'per_unit_ct',
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
