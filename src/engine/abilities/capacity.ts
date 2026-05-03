// Per-character bucket capacity computation.
// See docs/design/ability-slots.md and ADR-0007.
//
// Like cost, capacity is *computed* — never stored on the loadout. The
// baseline (per BASELINE_BUCKET_CAPACITIES, moving to RulesetDefinition
// in session 6) is the floor; equipment, status, and class traits with
// "+1 Active capacity" or "-2 Reaction capacity" effects compose at
// query time when their hook surfaces land.
//
// `getCapacity` returns Infinity for unknown buckets only when the
// caller has wandered off the closed-bucket-set path; v1 throws
// instead, matching the rest of the engine's "fail loud" stance.

import type { Catalog } from '../catalog/index.ts';
import {
  getUnit,
  type BucketId,
  type GameState,
  type UnitId,
} from '../types/index.ts';
import { ALL_BUCKET_IDS, BASELINE_BUCKET_CAPACITIES } from './constants.ts';

export function getCapacity(
  state: GameState,
  unitId: UnitId,
  bucketId: BucketId,
  _catalog: Catalog,
): number {
  // Side-effect: confirms the unit exists. Once equipment / class
  // traits modify capacity, their lookups go through the unit too.
  void getUnit(state, unitId);
  if (!ALL_BUCKET_IDS.includes(bucketId)) {
    throw new Error(
      `getCapacity: unknown BucketId ${JSON.stringify(bucketId)} — only the v1 buckets are supported`,
    );
  }
  const baseline = BASELINE_BUCKET_CAPACITIES.get(bucketId);
  if (baseline === undefined) {
    // Unreachable at v1 — every ALL_BUCKET_IDS entry has a baseline —
    // but the type system can't see the table covers the union.
    throw new Error(`getCapacity: no baseline capacity for ${JSON.stringify(bucketId)}`);
  }
  return baseline;
}
