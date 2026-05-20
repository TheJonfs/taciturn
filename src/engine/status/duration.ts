// Duration-shape predicates on StatusInstance.
// See ADR-0079 (KO/status interaction rule).
//
// `remainingDuration === null` is the canonical "no time decay" signal.
// Set by `applyStatus.computeInitialDuration` for every durationMode that
// doesn't tick down: `permanent`, `conditional`, `permanent_per_unit_ct`,
// `custom`. Finite modes (`global_ticks`, `per_unit_ct`, `turn_based`)
// always store a numeric duration.
//
// The predicate keeps the KO/status rule a one-liner — `isInfiniteDuration`
// is true for the four no-decay modes and false for the three counted
// modes, with no flag plumbing on StatusEffectType. Equipment-sourced
// instances always have null duration (they're applied permanently via
// the equipment-status pipeline), so they naturally fall on the infinite
// side and persist through KO without a separate kind-check.

import type { StatusInstance } from '../types/index.ts';

export function isInfiniteDuration(instance: StatusInstance): boolean {
  return instance.remainingDuration === null;
}
