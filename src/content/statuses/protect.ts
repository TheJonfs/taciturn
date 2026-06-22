// Protect — physical damage mitigation (S72 rework, ADR-0121). The physical
// twin of Shell; moved in lockstep so "Protect/Shell" mean the same kind of
// thing (a damage multiplier), not "one's a resistance number, the other's a
// multiplier."
//
// Protect is a one-directional multiplier on incoming *physical damage*: it
// halves the physical damage you take *after* resistance has set the starting
// rate, and does NOT touch physical absorption (resistance > 100 still heals).
// See shell.ts for the full rationale (approach 4 from the S72 discussion).
//
// Mechanism: an `onDamageReceived` handler that pushes a multiplier into
// `ctx.multipliers` when the damage carries the `'physical'` tag. Factor is
// `(100 − magnitude) / 100` — magnitude is the **% reduction** (default 50 ⇒
// ×0.5), scalable by a future buff-amplifier. Clamped at 0. Skips when the
// running product is already negative (resistance flipped it to absorption),
// leaving the absorbed heal intact.
//
// The behavior lives here once and is shared by the equipment-grant `protect`
// (permanent) and the cast `protect_cast` (timed) siblings.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
  type StatusHookRegistration,
} from '@engine/index.ts';

export const protectMitigationHook: StatusHookRegistration = statusHook(
  'onDamageReceived',
  (args, ctx) => {
    const dmg = args.ctx;
    if (!dmg.damageTags.has('physical')) return dmg;
    // Skip when resistance has already flipped this to absorption.
    const runningProduct = dmg.multipliers.reduce((p, m) => p * m.factor, 1);
    if (runningProduct < 0) return dmg;
    const magnitude = ctx.instance.magnitude ?? 0;
    const factor = Math.max(0, (100 - magnitude) / 100);
    return {
      ctx: { ...dmg, multipliers: [...dmg.multipliers, { source: 'protect', factor }] },
    };
  },
);

export const protect: StatusEffectType = {
  id: statusTypeId('protect'),
  name: 'Protect',
  tags: ['positive', 'dispellable'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  hooks: [protectMitigationHook],
};
