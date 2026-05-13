// Pure predicates over UseAbility / charged-action payloads.
//
// `isRiderCast` consolidates the `riderSource !== undefined` check that
// per ADR-0064/0068 controls five bypass gates: MP affordability + MP
// deduction, `onActionAttempted` pre-hooks, `actionSpeed` charge path,
// and Act-budget validation + decrement. Pre-Session-31.5 each site
// inlined the literal `!== undefined` read; consolidating ensures a
// uniform predicate (and one comment-anchor for future readers) without
// changing any behavior.

import type { UseAbilityPayload } from '../types/index.ts';

// A `use_ability` payload represents a rider cast (per ADR-0064) when
// it carries an explicit `riderSource`. Today's sole discriminant is
// `{ kind: 'equipment_proc', itemId }` (Bolt Hammer's Lightning Strike,
// Flametongue's Burn proc, the wand on-hit resistance shifts). Future
// rider sources (environmental hazards, ability-emitted spell-casts)
// extend the discriminated union; this predicate stays the same.
export function isRiderCast(payload: UseAbilityPayload): boolean {
  return payload.riderSource !== undefined;
}
