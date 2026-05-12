// Bucket identifiers — the engine surface for the v1 bucket set.
// See docs/design/ability-slots.md ("v1 bucket configuration") and
// ADR-0007.
//
// Per-bucket numeric capacity moved to the active ruleset in session 6
// (RulesetDefinition.bucketCapacities); this file is the source of
// truth only for *bucket identity*, the closed set of named buckets the
// engine recognizes. Adding a new bucket is an engine change here plus
// a matching entry in every ruleset's `bucketCapacities`.

import { bucketId, type BucketId } from '../types/index.ts';

export const BUCKET_FIRST_ACTION: BucketId = bucketId('first_action');
// Session 29 (ADR-0061): renamed from `'second_action'`. The bucket
// now models a list of command sets gated by capacity — Magus Crown's
// `bucketCapacityMods` lifts the baseline cap from 1 to 2, enabling a
// second secondary command set per the equipment doc.
export const BUCKET_SECONDARY_COMMAND_SETS: BucketId = bucketId('secondary_command_sets');
export const BUCKET_REACTION: BucketId = bucketId('reaction');
export const BUCKET_SUPPORT: BucketId = bucketId('support');
export const BUCKET_MOVEMENT: BucketId = bucketId('movement');

// Both active and passive buckets hold lists since Session 29 — actives
// of CommandSetIds, passives of AbilityIds. Validation gates total cost
// against capacity uniformly (see Loadout in engine/types/loadout.ts).
export const ACTIVE_BUCKET_IDS: ReadonlyArray<BucketId> = [
  BUCKET_FIRST_ACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
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

export type BucketKind = 'active' | 'passive';

export function bucketKind(id: BucketId): BucketKind {
  if (ACTIVE_BUCKET_IDS.includes(id)) return 'active';
  if (PASSIVE_BUCKET_IDS.includes(id)) return 'passive';
  // No magic third category — every BucketId v1 ships with is one or the
  // other. Throw on unknowns rather than silently classifying as one.
  throw new Error(`bucketKind: unknown BucketId ${JSON.stringify(id)}`);
}
