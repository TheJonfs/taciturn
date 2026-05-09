// Status application pipeline.
// See docs/design/status-effects.md ("Application pipeline").
//
// Pipeline order: resistance → stacking → instantiate → onApply → side
// effects. Resistance is a no-op in session 3 (no Unit.resistances field
// yet); side effects (e.g., immediate first tick) likewise wait for
// their consumers.
//
// `applyStatus` is pure: it returns a new GameState plus an outcome
// record. The reducer (session 7) calls into it from the relevant action
// reducers (UseAbility's status-applying abilities, system actions that
// apply Charging, etc.). Tests call it directly.

import type { Catalog, StatusEffectType } from '../catalog/index.ts';
import type {
  GameState,
  ItemId,
  StatusInstance,
  StatusInstanceSource,
  StatusTypeId,
  Unit,
  UnitId,
} from '../types/index.ts';
import { getUnit } from '../types/index.ts';
import type { StatusApplicationResult } from './result.ts';
import { fireOnApply, fireOnRemove } from './runners.ts';
import { applyStackingRule } from './stacking.ts';

export interface ApplyStatusArgs {
  readonly targetId: UnitId;
  readonly typeId: StatusTypeId;
  readonly sourceUnitId: UnitId | null;
  readonly sourceActionSeq: number | null;
  // Source provenance discriminator (per ADR-0028). Default `'unit'`
  // when omitted; the equipment apply path passes `'equipment'` plus
  // the granting `sourceEquipmentId`.
  readonly sourceKind?: 'unit' | 'equipment';
  readonly sourceEquipmentId?: ItemId;
  // When omitted, the type's `defaultMagnitude` is used.
  readonly magnitude?: number;
  // Required for `per_unit_ct`, `global_ticks`, and `turn_based`
  // duration modes; ignored for `permanent` and `conditional`. Throws
  // if missing for a duration-counted mode.
  readonly duration?: number;
  // For STACK_INDEPENDENT statuses, the per-instance custom state at
  // application time (e.g., the Charging status's chargedActionId).
  // For other rules, ignored.
  readonly customState?: Readonly<Record<string, unknown>>;
}

export interface ApplyStatusReturn {
  readonly newState: GameState;
  readonly result: StatusApplicationResult;
}

export function applyStatus(
  state: GameState,
  args: ApplyStatusArgs,
  catalog: Catalog,
): ApplyStatusReturn {
  const targetUnit = getUnit(state, args.targetId);
  const type = catalog.getStatusType(args.typeId);

  // 1. Resistance check — no-op until Unit.resistances lands.

  // 2/3. Build candidate instance (instantiation step). We always
  // construct it; the stacking rule decides whether it ends up on the
  // unit, refreshes an existing one, or is rejected.
  const candidate = buildCandidate(type, args);

  // Partition existing statuses by type for the stacking decision.
  const existingOfType: StatusInstance[] = [];
  const otherTypes: StatusInstance[] = [];
  for (const s of targetUnit.statuses) {
    if (s.typeId === type.id) existingOfType.push(s);
    else otherTypes.push(s);
  }

  const dispatch = applyStackingRule(type, existingOfType, candidate);

  // 4. onRemove for displaced instances, then onApply for new ones.
  // The unit reference is the *pre-update* unit; handlers that need
  // the post-update view should consult state through the runner.
  // (No runner exposes state to handlers in session 3; revisited when
  // a handler genuinely needs it.)
  for (const removed of dispatch.lifecycle.removed) {
    fireOnRemove(type, targetUnit, removed);
  }
  for (const added of dispatch.lifecycle.added) {
    fireOnApply(type, targetUnit, added);
  }

  // 5. Side-effect actions (e.g., immediate first tick) — not implemented
  // in session 3. When status types declare an "apply now" effect, the
  // action emission lands here and the return type grows a `actions`
  // field for the reducer to enqueue.

  // No state change for resisted / rejected.
  if (dispatch.result.kind === 'resisted' || dispatch.result.kind === 'rejected') {
    return { newState: state, result: dispatch.result };
  }

  // Splice the new same-type instances into the unit's statuses,
  // preserving the relative positions of other-type statuses. See the
  // helper for the algorithm.
  const newStatuses = spliceSameTypeInstances(
    targetUnit.statuses,
    type.id,
    dispatch.newInstancesOfType,
  );
  const newUnit: Unit = { ...targetUnit, statuses: newStatuses };
  const newUnits = new Map(state.units);
  newUnits.set(targetUnit.id, newUnit);
  const newState: GameState = { ...state, units: newUnits };

  // The `otherTypes` partition is shadowed by the splice helper; it was
  // used only for clarity in the lifecycle phase above.
  void otherTypes;

  return { newState, result: dispatch.result };
}

function buildCandidate(type: StatusEffectType, args: ApplyStatusArgs): StatusInstance {
  const remainingDuration = computeInitialDuration(type, args.duration);
  const magnitude = args.magnitude ?? type.defaultMagnitude;

  const source: StatusInstanceSource = {
    unitId: args.sourceUnitId,
    actionSeq: args.sourceActionSeq,
    ...(args.sourceKind !== undefined ? { kind: args.sourceKind } : {}),
    ...(args.sourceEquipmentId !== undefined ? { equipmentId: args.sourceEquipmentId } : {}),
  };

  const candidate: StatusInstance = {
    typeId: type.id,
    source,
    remainingDuration,
    ...(magnitude !== undefined ? { magnitude } : {}),
    ...(args.customState !== undefined ? { customState: args.customState } : {}),
  };
  return candidate;
}

function computeInitialDuration(
  type: StatusEffectType,
  requested: number | undefined,
): number | null {
  // No-decay modes always store null. `permanent_per_unit_ct` (ADR-0027)
  // ticks at the unit's CT cadence but never expires — the apply pipeline
  // discards any requested duration so the StatusEffectType stays the
  // single source of truth on whether time decrements.
  if (
    type.durationMode === 'permanent' ||
    type.durationMode === 'conditional' ||
    type.durationMode === 'permanent_per_unit_ct'
  ) {
    return null;
  }
  if (requested === undefined) {
    throw new Error(
      `applyStatus: durationMode=${type.durationMode} requires an explicit duration ` +
        `for status type ${JSON.stringify(type.id)}`,
    );
  }
  return requested;
}

// Splice helper: replace same-type instance positions in `original` with
// `replacements`, preserving the positions of other-type instances.
//
// Behavior:
// - Other-type instances stay at their original indices.
// - Same-type positions get filled by `replacements` in order.
// - If `replacements` is shorter than the number of same-type positions,
//   the extra positions are removed (instance disappeared).
// - If longer, the excess instances are appended after the last original
//   index. (STACK_INDEPENDENT growth case.)
// - If there were no same-type instances, `replacements` is appended to
//   the end (a brand-new type was applied).
function spliceSameTypeInstances(
  original: ReadonlyArray<StatusInstance>,
  typeId: StatusTypeId,
  replacements: ReadonlyArray<StatusInstance>,
): StatusInstance[] {
  const sameTypeIndices: number[] = [];
  original.forEach((s, i) => {
    if (s.typeId === typeId) sameTypeIndices.push(i);
  });

  if (sameTypeIndices.length === 0) {
    return [...original, ...replacements];
  }

  const slots: (StatusInstance | null)[] = original.map((s) => (s.typeId === typeId ? null : s));

  replacements.forEach((inst, i) => {
    if (i < sameTypeIndices.length) {
      slots[sameTypeIndices[i]!] = inst;
    } else {
      slots.push(inst);
    }
  });

  return slots.filter((s): s is StatusInstance => s !== null);
}
