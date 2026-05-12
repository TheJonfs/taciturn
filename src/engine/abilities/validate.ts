// Loadout validation.
// See docs/design/ability-slots.md and ADR-0007.
//
// Pure function: takes a state, a target unit, a candidate loadout, and
// the catalog; returns either `{ ok: true }` or a structured violation
// list. Violations are enumerated, not first-error: callers (UI in
// particular) want to show every problem at once.
//
// What we check:
// - Every passive abilityId in the loadout exists in the catalog.
// - Each passive ability is `kind: 'passive'` and lives in the bucket
//   it's equipped into (a passive priced for `'support'` cannot be
//   equipped in `'movement'`).
// - Per passive bucket, sum-of-getCost ≤ getCapacity.
// - Every active commandSetId exists in the catalog.
// - Each active bucket holds a valid CommandSetId (or null).
// - Active buckets get cost / capacity validation too — v1 capacity 1
//   and command-set cost 1 means it's trivially satisfied, but the
//   surface accepts modulations.
//
// What we do *not* check (deferred):
// - Learning state ("can this unit actually use this ability") — lands
//   with the progression session.
// - First Action being class-pinned. The validator accepts whatever the
//   loadout carries; it's `equipAbility`'s job (and eventually the
//   reducer's) to refuse changes that would break that pin.

import type { Catalog } from '../catalog/index.ts';
import {
  UnknownDefinitionError,
} from '../catalog/index.ts';
import {
  getUnit,
  type AbilityId,
  type BucketId,
  type CommandSetId,
  type GameState,
  type Loadout,
  type UnitId,
} from '../types/index.ts';
import {
  ACTIVE_BUCKET_IDS,
  ALL_BUCKET_IDS,
  BUCKET_FIRST_ACTION,
  PASSIVE_BUCKET_IDS,
} from './constants.ts';
import { getCapacity } from './capacity.ts';
import { getCommandSetCost, getCost } from './cost.ts';

export type LoadoutViolation =
  | {
      readonly kind: 'unknown_ability';
      readonly bucketId: BucketId;
      readonly abilityId: AbilityId;
    }
  | {
      readonly kind: 'unknown_command_set';
      readonly bucketId: BucketId;
      readonly commandSetId: CommandSetId;
    }
  | {
      readonly kind: 'wrong_kind_for_bucket';
      readonly bucketId: BucketId;
      readonly abilityId: AbilityId;
      readonly expected: 'active' | 'passive';
      readonly actual: 'active' | 'passive';
    }
  | {
      readonly kind: 'wrong_bucket';
      readonly bucketId: BucketId;
      readonly abilityId: AbilityId;
      readonly abilityHomeBucket: BucketId;
    }
  | {
      readonly kind: 'over_capacity';
      readonly bucketId: BucketId;
      readonly capacity: number;
      readonly used: number;
    }
  | {
      readonly kind: 'unknown_bucket';
      readonly bucketId: BucketId;
    }
  | {
      readonly kind: 'first_action_pin_violated';
      readonly expected: CommandSetId;
      readonly actual: CommandSetId | null;
    };

export type LoadoutValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: ReadonlyArray<LoadoutViolation> };

export function validateLoadout(
  state: GameState,
  unitId: UnitId,
  loadout: Loadout,
  catalog: Catalog,
): LoadoutValidation {
  const unit = getUnit(state, unitId);

  const violations: LoadoutViolation[] = [];

  // First Action class-pin: the first_action active bucket must hold
  // the unit's class's `firstActionCommandSet` as its sole entry. Class
  // is the source of truth for what command set lives there; loadout
  // cannot deviate. Per ADR-0061, the bucket holds a list, but the pin
  // semantics still require exactly one entry matching the class.
  const classDef = catalog.getClass(unit.classState.currentClass);
  const firstActionList: ReadonlyArray<CommandSetId> =
    loadout.actionBuckets[BUCKET_FIRST_ACTION] ?? [];
  const firstActionSlot: CommandSetId | null =
    firstActionList.length === 1 ? (firstActionList[0] ?? null) : null;
  if (firstActionSlot !== classDef.firstActionCommandSet || firstActionList.length !== 1) {
    violations.push({
      kind: 'first_action_pin_violated',
      expected: classDef.firstActionCommandSet,
      actual: firstActionSlot,
    });
  }

  // Active buckets. Per ADR-0061, each bucket holds a list of command
  // sets; total cost (sum of per-set baseCost) is gated against capacity.
  for (const bucketId of ACTIVE_BUCKET_IDS) {
    const entries: ReadonlyArray<CommandSetId> = loadout.actionBuckets[bucketId] ?? [];
    if (entries.length === 0) continue;
    let used = 0;
    let bucketHasUnknown = false;
    for (const csId of entries) {
      if (!catalog.hasCommandSet(csId)) {
        violations.push({ kind: 'unknown_command_set', bucketId, commandSetId: csId });
        bucketHasUnknown = true;
        continue;
      }
      used += getCommandSetCost(state, unitId, csId, catalog);
    }
    if (!bucketHasUnknown) {
      const cap = getCapacity(state, unitId, bucketId, catalog);
      if (used > cap) {
        violations.push({ kind: 'over_capacity', bucketId, capacity: cap, used });
      }
    }
  }

  // Passive buckets.
  for (const bucketId of PASSIVE_BUCKET_IDS) {
    const equipped: ReadonlyArray<AbilityId> = loadout.passiveBuckets[bucketId] ?? [];
    let used = 0;
    let bucketHasUnknownOrWrong = false;
    for (const abilityId of equipped) {
      let ability;
      try {
        ability = catalog.getAbility(abilityId);
      } catch (err: unknown) {
        if (err instanceof UnknownDefinitionError) {
          violations.push({ kind: 'unknown_ability', bucketId, abilityId });
          bucketHasUnknownOrWrong = true;
          continue;
        }
        throw err;
      }
      if (ability.kind !== 'passive') {
        violations.push({
          kind: 'wrong_kind_for_bucket',
          bucketId,
          abilityId,
          expected: 'passive',
          actual: ability.kind,
        });
        bucketHasUnknownOrWrong = true;
        continue;
      }
      if (ability.bucket !== bucketId) {
        violations.push({
          kind: 'wrong_bucket',
          bucketId,
          abilityId,
          abilityHomeBucket: ability.bucket,
        });
        bucketHasUnknownOrWrong = true;
        continue;
      }
      used += getCost(state, unitId, abilityId, catalog);
    }
    if (!bucketHasUnknownOrWrong) {
      const cap = getCapacity(state, unitId, bucketId, catalog);
      if (used > cap) {
        violations.push({ kind: 'over_capacity', bucketId, capacity: cap, used });
      }
    }
  }

  // Catch buckets the loadout references that aren't known. Authors
  // can typo `'reaktion'`; surface it.
  for (const bucketId of Object.keys(loadout.actionBuckets) as BucketId[]) {
    if (!ALL_BUCKET_IDS.includes(bucketId)) {
      violations.push({ kind: 'unknown_bucket', bucketId });
    }
  }
  for (const bucketId of Object.keys(loadout.passiveBuckets) as BucketId[]) {
    if (!ALL_BUCKET_IDS.includes(bucketId)) {
      violations.push({ kind: 'unknown_bucket', bucketId });
    }
  }

  return violations.length === 0
    ? { ok: true }
    : { ok: false, violations };
}
