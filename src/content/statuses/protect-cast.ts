// Protect (cast) — the timed form of Protect. Display name "Protect":
// the player sees "Protect" whether it came from future Knight armor
// (the permanent `protect` status, equipment lifecycle) or the
// Enchanter's Auramancy cast (this status, timed). Same `modifyResistance`
// handler (+magnitude physical resistance); the only difference from
// `protect` is `per_unit_ct` duration so the buff expires.
//
// Authored as a separate type per the steer in `protect.ts` ("a future
// cast-Protect spell follows the same `protect_cast` (per_unit_ct,
// 6-tick default, REFRESH) pattern as Shell"). magnitude 50 ⇒ ((100−50)
// /100) = 0.5× incoming physical, composed via signedMax against any
// native resistance.
//
// Stealable (`aiHints.polarity: 'buff'`, non-equipment) for the Thief's
// Steal Buffs loop (S72). `dispellable` for future dispel content.
//
// Balance note (S72 watch-for): reliable physical damage reduction shifts
// time-to-kill across the roster — flagged for the playtest pile.

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';
import { protectMitigationHook } from './protect.ts';

export const protectCast: StatusEffectType = {
  id: statusTypeId('protect_cast'),
  name: 'Protect',
  tags: ['positive', 'dispellable'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  exclusivityGroup: 'protect',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  // Aura Mastery amplifies cast Protect (ADR-0122). magnitude is the % damage
  // reduction (additive kind): 50 → 50×K, a deeper cut.
  amplifiable: true,
  // Shares the physical-damage mitigation hook with the equipment `protect`
  // (see protect.ts) — identical behavior, only the duration differs.
  hooks: [protectMitigationHook],
};
