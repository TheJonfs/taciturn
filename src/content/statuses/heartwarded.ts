// Heartwarded — Steal Heart's post-charm immunity marker. Applied to the
// target alongside `enthralled`, with a longer duration (5 vs 3, same
// per_unit_ct cadence), so it outlasts the charm by two of the unit's turns.
// Steal Heart's validation rejects a target that carries it, which:
//   - blocks chain-charm-lock (a 2-turn window after a charm ends where the
//     unit can't be re-charmed), AND
//   - blocks re-charming an already-charmed unit (it has heartwarded too).
// Because the immunity is applied at cast (not on revert), an early break
// still leaves the full window running from the cast — generous by design.
//
// No hooks and no effect of its own — it's a pure marker. Not a buff for
// Steal Buffs' purposes (no `polarity: 'buff'`), not Remedy-clearable
// (`remedyImmune`) — it represents a lingering wariness, not an ailment.

import { statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const heartwarded: StatusEffectType = {
  id: statusTypeId('heartwarded'),
  name: 'Heartwarded',
  tags: ['neutral'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  remedyImmune: true,
  controlOverrideImmune: true,
  hooks: [],
};
