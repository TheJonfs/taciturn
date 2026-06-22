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

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';
import { shellMitigationHook } from './shell.ts';

export const shellCast: StatusEffectType = {
  id: statusTypeId('shell_cast'),
  name: 'Shell',
  tags: ['positive', 'dispellable'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  // Aura Mastery amplifies cast Shell (ADR-0122). magnitude is the % damage
  // reduction (additive kind): 50 → 50×K, a deeper cut.
  amplifiable: true,
  // Shares the magical-damage mitigation hook with the equipment `shell` (see
  // shell.ts) — identical behavior, only the duration differs.
  hooks: [shellMitigationHook],
};
