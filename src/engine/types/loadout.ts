// Loadout — a unit's per-bucket equip state.
// See docs/design/ability-slots.md and docs/design/core-types.md ("Unit").
//
// Active buckets hold a single CommandSetId (or null when empty).
// Passive buckets hold a list of AbilityId references — the order is
// the equip order, used as the within-tier tiebreak for hook dispatch.
//
// The loadout is *stored* state (it persists between turns and across
// state transitions); per-character costs and capacities are *computed*
// from the loadout + unit + class + equipment, never cached on the
// loadout itself. See ADR-0007.

import type { AbilityId, BucketId, CommandSetId } from './ids.ts';

export interface Loadout {
  // BucketId → equipped command set, or null when nothing is selected.
  // The keys are the engine-known active buckets (first_action,
  // second_action). The Record-of-BucketId shape lets future buckets
  // join without a per-bucket field rename.
  readonly actionBuckets: Readonly<Record<BucketId, CommandSetId | null>>;
  // BucketId → equipped abilities in equip order.
  readonly passiveBuckets: Readonly<Record<BucketId, ReadonlyArray<AbilityId>>>;
}

export const EMPTY_LOADOUT: Loadout = {
  actionBuckets: {},
  passiveBuckets: {},
};
