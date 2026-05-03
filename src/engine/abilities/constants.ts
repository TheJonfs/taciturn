// Bucket identifiers and v1 baseline capacities.
// See docs/design/ability-slots.md ("v1 bucket configuration") and ADR-0007.
//
// These constants are the source of truth in v1. Session 6 promotes the
// capacity baseline into `RulesetDefinition` so alternate rulesets can
// override it (a hardcore ruleset might give 4-capacity Movement, etc.)
// — same pattern as `engine/ct/constants.ts`. Bucket *identity* (the
// five named buckets) stays here as engine surface; only the per-bucket
// numeric capacity moves to the ruleset.

import { bucketId, type BucketId } from '../types/index.ts';

export const BUCKET_FIRST_ACTION: BucketId = bucketId('first_action');
export const BUCKET_SECOND_ACTION: BucketId = bucketId('second_action');
export const BUCKET_REACTION: BucketId = bucketId('reaction');
export const BUCKET_SUPPORT: BucketId = bucketId('support');
export const BUCKET_MOVEMENT: BucketId = bucketId('movement');

// Active buckets hold a single CommandSetId; passives hold an
// AbilityId list. The two flavors share validation but differ in how
// the loadout is shaped (see Loadout in engine/types/loadout.ts).
export const ACTIVE_BUCKET_IDS: ReadonlyArray<BucketId> = [
  BUCKET_FIRST_ACTION,
  BUCKET_SECOND_ACTION,
];

export const PASSIVE_BUCKET_IDS: ReadonlyArray<BucketId> = [
  BUCKET_REACTION,
  BUCKET_SUPPORT,
  BUCKET_MOVEMENT,
];

export const ALL_BUCKET_IDS: ReadonlyArray<BucketId> = [
  ...ACTIVE_BUCKET_IDS,
  ...PASSIVE_BUCKET_IDS,
];

// v1 baseline per-bucket capacity. Each entry is the cap when no
// modifiers apply. Class / equipment / status modifiers compose on top
// at query time.
export const BASELINE_BUCKET_CAPACITIES: ReadonlyMap<BucketId, number> = new Map([
  [BUCKET_FIRST_ACTION, 1],
  [BUCKET_SECOND_ACTION, 1],
  [BUCKET_REACTION, 3],
  [BUCKET_SUPPORT, 3],
  [BUCKET_MOVEMENT, 3],
]);

export type BucketKind = 'active' | 'passive';

export function bucketKind(id: BucketId): BucketKind {
  if (ACTIVE_BUCKET_IDS.includes(id)) return 'active';
  if (PASSIVE_BUCKET_IDS.includes(id)) return 'passive';
  // No magic third category — every BucketId v1 ships with is one or the
  // other. Throw on unknowns rather than silently classifying as one.
  throw new Error(`bucketKind: unknown BucketId ${JSON.stringify(id)}`);
}
