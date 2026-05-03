// Loadout equip / unequip operations.
// See docs/design/ability-slots.md and ADR-0007.
//
// Pure functions: takes a state and a proposed change, returns the
// new state (with the unit's loadout replaced) if valid, or a
// validation failure. They never mutate.
//
// Three operations are exposed:
// - `equipPassive`     — append an ability to a passive bucket
// - `unequipPassive`   — remove a specific instance (by index) from a
//                        passive bucket
// - `setActiveBucket`  — set the command set in an active bucket
//                        (or clear it with null)
//
// Each runs `validateLoadout` against the *would-be* loadout and only
// commits if it passes. Cascading invalidation (per design's open
// question) is the caller's concern; equip itself simply refuses
// changes that would create a violation.
//
// State updates: returns a new GameState with the unit replaced via
// `state.units` Map clone. The Unit type is mostly readonly today;
// `loadout` is `readonly` and we replace it wholesale.

import type { Catalog } from '../catalog/index.ts';
import {
  getUnit,
  type AbilityId,
  type BucketId,
  type CommandSetId,
  type GameState,
  type Loadout,
  type Unit,
  type UnitId,
} from '../types/index.ts';
import { validateLoadout, type LoadoutValidation } from './validate.ts';

export interface EquipResultOk {
  readonly ok: true;
  readonly state: GameState;
}

export interface EquipResultFail {
  readonly ok: false;
  readonly validation: LoadoutValidation; // always { ok: false; violations }
}

export type EquipResult = EquipResultOk | EquipResultFail;

function withLoadout(unit: Unit, loadout: Loadout): Unit {
  return { ...unit, loadout };
}

function withReplacedUnit(state: GameState, replaced: Unit): GameState {
  const units = new Map(state.units);
  units.set(replaced.id, replaced);
  return { ...state, units };
}

function commitOrFail(
  state: GameState,
  unit: Unit,
  candidate: Loadout,
  catalog: Catalog,
): EquipResult {
  const validation = validateLoadout(state, unit.id, candidate, catalog);
  if (!validation.ok) return { ok: false, validation };
  const newUnit = withLoadout(unit, candidate);
  return { ok: true, state: withReplacedUnit(state, newUnit) };
}

export function equipPassive(
  state: GameState,
  unitId: UnitId,
  bucketId: BucketId,
  abilityId: AbilityId,
  catalog: Catalog,
): EquipResult {
  const unit = getUnit(state, unitId);
  const current = unit.loadout.passiveBuckets[bucketId] ?? [];
  const candidate: Loadout = {
    ...unit.loadout,
    passiveBuckets: {
      ...unit.loadout.passiveBuckets,
      [bucketId]: [...current, abilityId],
    },
  };
  return commitOrFail(state, unit, candidate, catalog);
}

export function unequipPassive(
  state: GameState,
  unitId: UnitId,
  bucketId: BucketId,
  index: number,
  catalog: Catalog,
): EquipResult {
  const unit = getUnit(state, unitId);
  const current = unit.loadout.passiveBuckets[bucketId] ?? [];
  if (index < 0 || index >= current.length) {
    throw new Error(
      `unequipPassive: index ${index} out of range for bucket ${JSON.stringify(bucketId)} (size ${current.length})`,
    );
  }
  const next = [...current.slice(0, index), ...current.slice(index + 1)];
  const candidate: Loadout = {
    ...unit.loadout,
    passiveBuckets: { ...unit.loadout.passiveBuckets, [bucketId]: next },
  };
  return commitOrFail(state, unit, candidate, catalog);
}

export function setActiveBucket(
  state: GameState,
  unitId: UnitId,
  bucketId: BucketId,
  commandSetId: CommandSetId | null,
  catalog: Catalog,
): EquipResult {
  const unit = getUnit(state, unitId);
  const candidate: Loadout = {
    ...unit.loadout,
    actionBuckets: { ...unit.loadout.actionBuckets, [bucketId]: commandSetId },
  };
  return commitOrFail(state, unit, candidate, catalog);
}
