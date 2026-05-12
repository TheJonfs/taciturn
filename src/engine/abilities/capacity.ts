// Per-character bucket capacity computation.
// See docs/design/ability-slots.md and ADR-0007 / ADR-0008 / ADR-0059.
//
// Like cost, capacity is *computed* — never stored on the loadout. The
// baseline (read from the active ruleset's `bucketCapacities`) is the
// floor; equipment, status, and class traits compose additively through
// `modifyBucketCapacity` (Session 28 / ADR-0059). The final value is
// floored at 0 to prevent author errors from producing negative capacity.

import type { Catalog } from '../catalog/index.ts';
import { runModifyBucketCapacity } from '../hooks/runners.ts';
import {
  getUnit,
  type BucketId,
  type GameState,
  type UnitId,
} from '../types/index.ts';
import { ALL_BUCKET_IDS } from './constants.ts';

export function getCapacity(
  state: GameState,
  unitId: UnitId,
  bucketId: BucketId,
  catalog: Catalog,
): number {
  const unit = getUnit(state, unitId);
  if (!ALL_BUCKET_IDS.includes(bucketId)) {
    throw new Error(
      `getCapacity: unknown BucketId ${JSON.stringify(bucketId)} — only the v1 buckets are supported`,
    );
  }
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const baseline = ruleset.bucketCapacities.get(bucketId);
  if (baseline === undefined) {
    // The ruleset is missing a capacity for a known bucket — author
    // bug, fail loud per CLAUDE.md "don't catch errors silently."
    throw new Error(
      `getCapacity: ruleset ${JSON.stringify(ruleset.id)} has no baseline capacity for bucket ${JSON.stringify(bucketId)}`,
    );
  }
  const composed = runModifyBucketCapacity(state, catalog, {
    unit,
    bucket: bucketId,
    baseCapacity: baseline,
  });
  return Math.max(0, Math.floor(composed));
}
