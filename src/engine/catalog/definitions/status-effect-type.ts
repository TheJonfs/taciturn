// StatusEffectType — the catalog definition of a kind of status effect.
// See docs/design/status-effects.md ("Status type and instance").
//
// The instance lives on a unit (engine/types/status.ts); the type lives
// here in the catalog and carries everything universal: tags, duration
// mode, stacking rule, default magnitude, and hook handlers.

import type { Catalog } from '../catalog.ts';
import type {
  DamageTag,
  DurationMode,
  GameState,
  StackingRule,
  StatusInstance,
  StatusTag,
  StatusTypeId,
  Unit,
} from '../../types/index.ts';
import type { StatusHookRegistration } from '../../status/hooks.ts';

// Per ADR-0030 / ADR-0032: declarative trigger condition for `'custom'`
// durationMode. The kind names which existing engine hook fires the
// trigger:
//   - `'on_unit_ct_100'` rides the per-unit-CT status_tick → onTick path
//     (Burn).
//   - `'on_damage_received'` rides the existing onDamageReceived hook
//     fired at the target stage of the damage pipeline (Vulnerable).
//     The status's onDamageReceived handler returns the modified ctx
//     and emits a `status_remove` against itself for one-shot
//     consumption.
// Future kinds extend the union; each maps to an existing event hook so
// no new hook surface is required.
export type CustomTriggerSpec =
  | { readonly kind: 'on_unit_ct_100' }
  | { readonly kind: 'on_damage_received' };

// Per ADR-0030: apply-time customState computation for status types whose
// per-instance state depends on the caster (e.g., Burn snapshots the
// applier's MA at apply time). Called inside `applyStatus` after
// partitioning the unit's existing same-type instances and before
// `buildCandidate` constructs the incoming instance. The composer's
// returned `customState` and `stacks` (when present) replace the
// candidate's; STACK_COUNT_ADDITIVE then uses the resulting incoming
// values directly without further merge.
export interface ComposeApplyStateArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  // null when applied without a unit caster (system-driven applications).
  readonly caster: Unit | null;
  // null when there's no existing same-type instance on the target.
  // STACK_COUNT_ADDITIVE composers read this to merge with prior state.
  readonly existingInstance: StatusInstance | null;
  // The application's requested stack quantity. Defaults to 1 at the
  // call site; abilities that apply >1 stack per cast (Spark applies 2)
  // pass the count via `StatusEffectSpec.stackQuantity`.
  readonly requestedStackQuantity: number;
}

export interface ComposeApplyStateResult {
  readonly customState?: Readonly<Record<string, unknown>>;
  readonly stacks?: number;
}

export interface StatusEffectType {
  readonly id: StatusTypeId;
  readonly name: string;
  readonly tags: ReadonlyArray<StatusTag>;
  readonly durationMode: DurationMode;
  readonly stackingRule: StackingRule;
  readonly defaultMagnitude?: number;
  readonly hooks: ReadonlyArray<StatusHookRegistration>;
  // Optional resistance tag — when set, the BMG status application
  // formula reads `target.resistances[resistanceTag]` and multiplies
  // `(1 - resistance/100)` into the chance. Omitted → status can't
  // be resisted. Per ADR-0024 / BMG "Status application chance".
  readonly resistanceTag?: DamageTag;
  // When `true`, instances of this type are auto-removed when their
  // source unit (status.source.unitId) drops to 0 HP. The reducer
  // emits a `status_remove` for each affected instance after any
  // damage step that KOs a unit. Default `false` — preserves
  // existing statuses' lifecycles. v1 consumer: Taunted (per
  // ADR-0028).
  readonly removeOnSourceKO?: boolean;
  // Required when `durationMode === 'custom'` (ADR-0030). The kind
  // names which engine event drives the trigger; the engine routes
  // the firing through the corresponding existing hook. v1 supports
  // `'on_unit_ct_100'` (Burn). `'custom'` without `customTrigger` is
  // a content authoring error — `applyStatus` throws.
  readonly customTrigger?: CustomTriggerSpec;
  // Optional: per-status apply-time customState computation. Called
  // by `applyStatus` to compute the incoming instance's customState
  // (and optionally stack count) before stacking dispatch. v1 consumer
  // is Burn — snapshots applier's MA into per-stack damage values.
  // Per ADR-0030.
  readonly composeApplyState?: (args: ComposeApplyStateArgs) => ComposeApplyStateResult;
  // Optional: per-status decrement-time customState transform. Called
  // by `reduceStatusDecrementStack` before the count decrement.
  // Returns the new customState to attach to the decremented instance.
  // v1 consumer is Burn — FIFO-shifts the stackDamages array. Per
  // ADR-0030.
  readonly customStateOnDecrement?: (
    instance: StatusInstance,
  ) => Readonly<Record<string, unknown>> | undefined;
}
