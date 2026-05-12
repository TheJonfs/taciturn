// Loadout — a unit's per-bucket equip state.
// See docs/design/ability-slots.md and docs/design/core-types.md ("Unit").
//
// Both active and passive buckets hold a list — list length × per-entry
// cost is gated against bucket capacity (`getCapacity`). For active
// buckets the entries are CommandSetIds; for passives, AbilityIds. The
// list order is the equip order, used as the within-tier tiebreak for
// hook dispatch.
//
// Session 29 (ADR-0061): `actionBuckets` shape lifted from
// `CommandSetId | null` to `ReadonlyArray<CommandSetId>` so the
// `secondary_command_sets` bucket can hold multiple sets when capacity
// is lifted (Magus Crown). `first_action` still functions as a single
// pinned slot (capacity 1) but uses the same shape for uniformity.
//
// The loadout is *stored* state (it persists between turns and across
// state transitions); per-character costs and capacities are *computed*
// from the loadout + unit + class + equipment, never cached on the
// loadout itself. See ADR-0007.

import type { AbilityId, BucketId, CommandSetId } from './ids.ts';

export interface Loadout {
  // BucketId → equipped command sets in equip order. Empty list when
  // nothing is equipped. The Record-of-BucketId shape lets future
  // buckets join without a per-bucket field rename.
  readonly actionBuckets: Readonly<Record<BucketId, ReadonlyArray<CommandSetId>>>;
  // BucketId → equipped abilities in equip order.
  readonly passiveBuckets: Readonly<Record<BucketId, ReadonlyArray<AbilityId>>>;
}

export const EMPTY_LOADOUT: Loadout = {
  actionBuckets: {},
  passiveBuckets: {},
};
