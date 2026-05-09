// Status removal — explicit removal by (unitId, typeId).
// See docs/design/status-effects.md ("Removal") and ADR-0028
// (equipment-sourced statuses immune to in-battle removal).
//
// Session 3 supports this single removal path:
//   removeStatus(state, { targetId, typeId }, catalog)
//     → removes every unit-sourced instance of `typeId` on the unit,
//       fires onRemove for each. Equipment-sourced instances are
//       silent no-ops — status-stripping abilities don't disarm
//       equipment grants. Mid-battle equipment removal (theft, break)
//       eventually needs the `force` path; v1 has no such consumer.
//
// Other removal paths (duration expiry, conditional satisfaction, source
// loss, death cleanup) arrive with the systems that surface them
// (session 9 for duration ticking, etc.). This function is the universal
// "drop the instances and fire the hooks" core they all eventually call.

import type { Catalog } from '../catalog/index.ts';
import type { GameState, StatusInstance, StatusTypeId, Unit, UnitId } from '../types/index.ts';
import { getUnit } from '../types/index.ts';
import { fireOnRemove } from './runners.ts';

export interface RemoveStatusArgs {
  readonly targetId: UnitId;
  readonly typeId: StatusTypeId;
  // When `true`, also removes equipment-sourced instances. Reserved
  // for the (deferred) mid-battle equipment-removal path; v1 callers
  // omit this and equipment-sourced instances stay put.
  readonly force?: boolean;
}

export interface RemoveStatusReturn {
  readonly newState: GameState;
  readonly removed: ReadonlyArray<StatusInstance>;
}

export function removeStatus(
  state: GameState,
  args: RemoveStatusArgs,
  catalog: Catalog,
): RemoveStatusReturn {
  const targetUnit = getUnit(state, args.targetId);
  const type = catalog.getStatusType(args.typeId);

  const removed: StatusInstance[] = [];
  const kept: StatusInstance[] = [];
  for (const s of targetUnit.statuses) {
    if (s.typeId === type.id && !isEquipmentSourced(s, args.force)) {
      removed.push(s);
    } else {
      kept.push(s);
    }
  }

  if (removed.length === 0) {
    return { newState: state, removed: [] };
  }

  for (const r of removed) {
    fireOnRemove(type, targetUnit, r);
  }

  const newUnit: Unit = { ...targetUnit, statuses: kept };
  const newUnits = new Map(state.units);
  newUnits.set(targetUnit.id, newUnit);
  const newState: GameState = { ...state, units: newUnits };

  return { newState, removed };
}

function isEquipmentSourced(s: StatusInstance, force: boolean | undefined): boolean {
  if (force === true) return false;
  return s.source.kind === 'equipment';
}
