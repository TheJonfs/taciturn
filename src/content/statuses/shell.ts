// Shell — magical damage mitigation (S72 rework, ADR-0121).
//
// Shell is a one-directional multiplier on incoming *magical damage*, not a
// resistance number: it halves the magic damage you take *after* resistance
// has set the starting rate, and it does NOT touch magical healing /
// absorption (cranking resistance > 100 still heals you for the full amount).
// This is "approach 4" from the S72 design discussion — chosen over the prior
// additive `modifyResistance` (+50 magical) because the multiplier reads as a
// clean "halve the magic that hurts you" and composes predictably with
// vulnerabilities and resistances (no signed-max surprise).
//
// Mechanism: an `onDamageReceived` handler (the Damage Reduction precedent)
// that pushes a multiplier into `ctx.multipliers` when the damage carries the
// `'magical'` tag. The factor is `(100 − magnitude) / 100` — magnitude is the
// **% reduction** (default 50 ⇒ ×0.5), so a future buff-amplifier scales the
// cut by scaling the magnitude (60 ⇒ ×0.4). Clamped at factor 0 (≥100%
// reduction = immune, never negative).
//
// One-directional: resistance_check runs before onDamageReceived, so by the
// time this fires the running product of `ctx.multipliers` already carries the
// resistance factor — and `raw = (base + additives) × ∏multipliers`, so a
// negative running product means resistance has flipped this to absorption.
// In that case Shell stays out (returns the ctx unchanged), leaving the
// absorbed heal intact.
//
// The behavior lives here once and is shared by the equipment-grant `shell`
// (permanent) and the cast `shell_cast` (timed) siblings (the regen /
// regen_auto pattern), so Shell behaves identically regardless of source.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
  type StatusHookRegistration,
} from '@engine/index.ts';

export const shellMitigationHook: StatusHookRegistration = statusHook(
  'onDamageReceived',
  (args, ctx) => {
    const dmg = args.ctx;
    if (!dmg.damageTags.has('magical')) return dmg;
    // Skip when resistance has already flipped this to absorption (negative
    // running product ⇒ raw < 0): never reduce magic you absorb.
    const runningProduct = dmg.multipliers.reduce((p, m) => p * m.factor, 1);
    if (runningProduct < 0) return dmg;
    const magnitude = ctx.instance.magnitude ?? 0;
    const factor = Math.max(0, (100 - magnitude) / 100);
    return {
      ctx: { ...dmg, multipliers: [...dmg.multipliers, { source: 'shell', factor }] },
    };
  },
);

export const shell: StatusEffectType = {
  id: statusTypeId('shell'),
  name: 'Shell',
  tags: ['positive', 'dispellable'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  defaultMagnitude: 50,
  aiHints: { polarity: 'buff' },
  hooks: [shellMitigationHook],
};
