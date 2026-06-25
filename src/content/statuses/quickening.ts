// Quickening — the cast (timed) form of Haste. Display name "Haste":
// the player sees "Haste" whether it came from Boots of Haste (the
// permanent `haste` status, equipment lifecycle) or from the Enchanter's
// Auramancy cast (this status, timed). Same single `modifyStatQuery`
// handler (Speed × magnitude); the only difference from `haste` is the
// duration model — `per_unit_ct` so the buff ticks down on the
// recipient's CT cadence and expires, giving the Enchanter recurring
// work re-applying it.
//
// Authored as a separate type per the steer in `haste.ts` ("when a
// timed-Haste ability lands later, the right shape is a separate status
// type (e.g., `quickening`) ... rather than retroactively re-typing this
// one"). With both active on a unit, `computeSpeed`'s composition is
// last-writer / max per the stat-query chain — a cast Quickening and an
// equipment Haste don't double-multiply Speed in v1 content (no unit
// carries both today; flagged if a future build pairs them).
//
// Stealable: `aiHints.polarity: 'buff'` + non-equipment source means the
// Thief's Steal Buffs lifts it (the buff-economy loop, S72). `dispellable`
// tags it for future dispel content.

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';
import { hasteSpeedHook } from './haste.ts';

export const quickening: StatusEffectType = {
  id: statusTypeId('quickening'),
  name: 'Haste',
  tags: ['positive', 'time', 'dispellable'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'haste',
  defaultMagnitude: 1.5,
  aiHints: { polarity: 'buff' },
  // Aura Mastery amplifies cast Haste (ADR-0122). magnitude is a Speed
  // multiplier, so the amplifier scales the *bonus*: 1.5 → 1 + 0.5×K.
  amplifiable: true,
  magnitudeKind: 'multiplier',
  // Shares the Speed × magnitude hook with the equipment `haste` (see
  // haste.ts) — identical behavior, only the duration model differs.
  hooks: [hasteSpeedHook],
};
