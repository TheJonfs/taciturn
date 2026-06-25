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
import {
  runModifyIncomingStatusDuration,
  runModifyOutgoingStatusMagnitude,
  runModifyStatusApplicationStackCount,
} from '../hooks/runners.ts';
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
  // duration modes; ignored for `permanent`, `conditional`,
  // `permanent_per_unit_ct`, and `'custom'`. Throws if missing for a
  // duration-counted mode.
  readonly duration?: number;
  // For STACK_INDEPENDENT statuses, the per-instance custom state at
  // application time (e.g., the Charging status's chargedActionId).
  // For other rules, ignored unless the type defines composeApplyState
  // (which can read this through ComposeApplyStateArgs.requestedStackQuantity
  // / existingInstance — but custom state itself is composed by the
  // type's composer, not by this argument).
  readonly customState?: Readonly<Record<string, unknown>>;
  // Per ADR-0030: how many stacks this application requests. Defaults
  // to 1. Forwarded into the type's composeApplyState as
  // `requestedStackQuantity`. For STACK_COUNT_ADDITIVE statuses with
  // no composer, this becomes the candidate's `stacks` field.
  readonly stackQuantity?: number;
  // Session 45 follow-up (ADR-0084): the tags of the ability that drove
  // this application (`AbilityCommon.tags`). Threaded so the source's
  // equipment can gate stack-count modifiers on flavor (Wand of Lumen
  // only bumps `fire`-tagged abilities' Burn applications). Defaults to
  // an empty array on system / non-ability paths.
  readonly sourceAbilityTags?: ReadonlyArray<string>;
  // Per-action seed for apply-time target-side reactions (Thief — Slip
  // Free's `modifyIncomingStatusDuration` Brave gate). Present only on
  // in-battle, action-driven applications (an ability landing a debuff);
  // absent for setup grants, equipment, and composer-internal applies — on
  // those paths the incoming-duration hook is skipped entirely.
  readonly seed?: number;
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

  // Per ADR-0030 sanity check: 'custom' durationMode requires customTrigger.
  if (type.durationMode === 'custom' && type.customTrigger === undefined) {
    throw new Error(
      `applyStatus: status type ${JSON.stringify(type.id)} declares durationMode='custom' but no customTrigger`,
    );
  }

  // 1. Resistance check — no-op until Unit.resistances lands.

  // Partition existing statuses by type. The composeApplyState method
  // (ADR-0030) needs to see the existing same-type instance to merge
  // customState/stacks; the stacking rule needs the partition for its
  // dispatch. Both run after partitioning.
  const existingOfType: StatusInstance[] = [];
  const otherTypes: StatusInstance[] = [];
  for (const s of targetUnit.statuses) {
    if (s.typeId === type.id) existingOfType.push(s);
    else otherTypes.push(s);
  }

  // Mutual-exclusion group (S74, ADR-0124). If this status declares an
  // `exclusivityGroup` and the unit already holds a DIFFERENT-typed status in
  // the same group, reject the application — the two represent one conceptual
  // effect and must not compound (e.g. Boots-of-Haste `haste` + a cast
  // `quickening` → ×2.25 Speed). First holder wins: equipment grants apply at
  // battle start, so the permanent form takes the slot and the later timed
  // cast is the one rejected. Same-type re-application is NOT affected here —
  // it falls through to the per-type stacking rule (re-casting refreshes).
  if (type.exclusivityGroup !== undefined) {
    const occupied = otherTypes.some(
      (s) => catalog.getStatusType(s.typeId).exclusivityGroup === type.exclusivityGroup,
    );
    if (occupied) {
      return { newState: state, result: { kind: 'rejected', reason: 'exclusivity_group' } };
    }
  }

  // Session 45 follow-up (ADR-0084): source-side stack-count modifier
  // hook fires here so a +N delta (Wand of Lumen on Burn) is folded into
  // `requestedStackQuantity` before the type's composer reads it — Burn
  // builds N+1 stack damages from one application, no re-entry into the
  // apply path. Skipped for system / source-less applies (returns base).
  const caster = args.sourceUnitId !== null ? state.units.get(args.sourceUnitId) ?? null : null;
  const baseStackQuantity = args.stackQuantity ?? 1;
  const requestedStackQuantity = runModifyStatusApplicationStackCount(state, catalog, {
    target: targetUnit,
    source: caster,
    statusTypeId: type.id,
    statusTags: type.tags,
    sourceAbilityTags: args.sourceAbilityTags ?? [],
    baseCount: baseStackQuantity,
  });

  // Incoming-status duration shave (Thief — Slip Free). For a finite-
  // duration status applied to this unit BY ANOTHER unit (an action-driven
  // application carrying a seed, not an equipment grant or self-application),
  // the target's `modifyIncomingStatusDuration` passives may shorten the
  // incoming duration before the instance is built. A result of 0 negates
  // the application outright — Slip Free turning a 1-tick debuff into
  // nothing. The runner gates on the status tags + its own Brave roll, so a
  // buff or a status the handler ignores passes through unchanged.
  let effectiveDuration = args.duration;
  if (
    args.seed !== undefined &&
    args.duration !== undefined &&
    args.sourceKind !== 'equipment' &&
    args.sourceUnitId !== null &&
    args.sourceUnitId !== args.targetId
  ) {
    effectiveDuration = runModifyIncomingStatusDuration(state, catalog, {
      unit: targetUnit,
      statusTypeId: type.id,
      statusTags: type.tags,
      baseDuration: args.duration,
      seed: args.seed,
    });
    if (effectiveDuration <= 0) {
      return { newState: state, result: { kind: 'resisted' } };
    }
  }

  // Per ADR-0030: composer runs before buildCandidate. When defined, it
  // computes the resulting customState (post-merge with existing) and
  // optionally the resulting stacks count. Burn snapshots the caster's
  // MA into per-stack damage values here.
  let composedCustomState: Readonly<Record<string, unknown>> | undefined = args.customState;
  let composedStacks: number | undefined;
  if (type.composeApplyState !== undefined) {
    const composed = type.composeApplyState({
      state,
      catalog,
      caster,
      existingInstance: existingOfType[0] ?? null,
      requestedStackQuantity,
    });
    if (composed.customState !== undefined) composedCustomState = composed.customState;
    if (composed.stacks !== undefined) composedStacks = composed.stacks;
  }

  // Caster-side magnitude amplification (S72, ADR-0122). Aura Mastery scales an
  // `amplifiable` buff's magnitude at apply time. Gated to volitional,
  // non-equipment applications with a real caster — equipment grants and
  // system / source-less applies are never amplified. The scaled value is
  // baked into the instance (so it persists, is stealable, etc.).
  const baseMagnitude = args.magnitude ?? type.defaultMagnitude;
  const amplifiedMagnitude =
    baseMagnitude !== undefined && caster !== null && args.sourceKind !== 'equipment'
      ? runModifyOutgoingStatusMagnitude(state, catalog, {
          caster,
          target: targetUnit,
          statusType: type,
          baseMagnitude,
        })
      : baseMagnitude;

  // 2/3. Build candidate instance (instantiation step). We always
  // construct it; the stacking rule decides whether it ends up on the
  // unit, refreshes an existing one, or is rejected.
  const candidate = buildCandidate(type, args, {
    customState: composedCustomState,
    stacks: composedStacks ?? (requestedStackQuantity > 1 ? requestedStackQuantity : undefined),
    duration: effectiveDuration,
    magnitude: amplifiedMagnitude,
  });

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

interface CandidateOverrides {
  readonly customState?: Readonly<Record<string, unknown>> | undefined;
  readonly stacks?: number | undefined;
  // The post-shave duration to instantiate with (Slip Free). Falls back to
  // `args.duration` when no incoming-duration hook modified it.
  readonly duration?: number | undefined;
  // The post-amplification magnitude (Aura Mastery, ADR-0122). Falls back to
  // `args.magnitude ?? type.defaultMagnitude` when no caster-side magnitude
  // hook applied.
  readonly magnitude?: number | undefined;
}

function buildCandidate(
  type: StatusEffectType,
  args: ApplyStatusArgs,
  overrides: CandidateOverrides,
): StatusInstance {
  const remainingDuration = computeInitialDuration(type, overrides.duration ?? args.duration);
  const magnitude = overrides.magnitude ?? args.magnitude ?? type.defaultMagnitude;

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
    ...(overrides.customState !== undefined ? { customState: overrides.customState } : {}),
    ...(overrides.stacks !== undefined ? { stacks: overrides.stacks } : {}),
  };
  return candidate;
}

function computeInitialDuration(
  type: StatusEffectType,
  requested: number | undefined,
): number | null {
  // No-decay modes always store null. `permanent_per_unit_ct` (ADR-0027)
  // ticks at the unit's CT cadence but never expires; `'custom'` (ADR-0030)
  // is event-driven and ignores time entirely. The apply pipeline
  // discards any requested duration for these modes so the StatusEffectType
  // stays the single source of truth on whether time decrements.
  if (
    type.durationMode === 'permanent' ||
    type.durationMode === 'conditional' ||
    type.durationMode === 'permanent_per_unit_ct' ||
    type.durationMode === 'custom'
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
