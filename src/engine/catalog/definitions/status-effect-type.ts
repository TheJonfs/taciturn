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
  // The unit receiving the status. S74: composers that route a magnitude
  // through `modifyOutgoingStatusMagnitude` (Burn's per-stack damage) need
  // the target for the hook args.
  readonly target: Unit;
  // This status's own type. S74: passed so composers can name themselves
  // to `modifyOutgoingStatusMagnitude` without a self-referential const.
  readonly statusType: StatusEffectType;
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

// Per session 20b: decorative AI-side hints. Pure metadata — the engine
// never reads it; consumers in `src/ai/` (and future content-aware
// tools) read it to make decisions content can drive without the AI
// hardcoding status names. `polarity` declares whether application
// helps the recipient ('buff') or harms them ('debuff'). Statuses
// without an aiHints declaration default to 'debuff' from the AI's
// point of view (the safer assumption — never propose application to
// allies for an undeclared status).
export interface StatusAiHints {
  readonly polarity?: 'buff' | 'debuff';
}

export interface StatusEffectType {
  readonly id: StatusTypeId;
  readonly name: string;
  readonly tags: ReadonlyArray<StatusTag>;
  readonly durationMode: DurationMode;
  readonly stackingRule: StackingRule;
  // Mutual-exclusion group (S74, ADR-0124). The `stackingRule` only resolves
  // applications of the *same* `typeId`; this groups *different* types that
  // represent the same conceptual effect so they can't compound on one unit.
  // When set, applying this status is rejected if the unit already holds a
  // DIFFERENT-typed status with the same group string (the first holder wins —
  // equipment/permanent grants apply at battle start, so they take the slot and
  // a later timed cast of the sibling form is the one rejected). v1 groups the
  // permanent equipment forms with their timed Auramancy/cast siblings:
  // 'haste' (haste/quickening), 'protect' (protect/protect_cast), 'shell'
  // (shell/shell_cast), 'regen' (regen_auto/regen) — so e.g. Boots of Haste +
  // a cast Haste no longer stack to ×2.25 Speed. Same-type re-application still
  // follows `stackingRule` (re-casting refreshes, not rejects).
  readonly exclusivityGroup?: string;
  readonly defaultMagnitude?: number;
  // Buff-amplification opt-in (S72, ADR-0122). When `true`, a caster-side
  // magnitude amplifier (the Enchanter's Aura Mastery support, via the
  // `modifyOutgoingStatusMagnitude` hook) scales this status's magnitude by its
  // factor K at apply time. Default `false` — most statuses are NOT amplifiable.
  //
  // AUTHORING NOTE — when adding a new status whose *strength* lives in its
  // magnitude (a damage multiplier, a heal/regen coefficient, a resistance or
  // crit bump — NOT a flat stat point like PA/MA/Move Up, and NOT a reaction
  // self-buff or an equipment-grant variant), decide whether it should be
  // amplifiable: if its `defaultMagnitude` represents "effect strength" that a
  // dedicated buffer should be able to deepen, set `amplifiable: true` and the
  // correct `magnitudeKind`. This keeps the Aura-style supports working on new
  // content without re-touching the support. See docs/design/status-effects.md
  // ("Amplifiable buffs").
  readonly amplifiable?: boolean;
  // How this status's `magnitude` reads, so an amplifier scales it correctly:
  //   - 'additive' (default): magnitude is an additive/coefficient value
  //     (resistance points, crit bump, a damage-reduction %, a regen
  //     coefficient). Amplified as `magnitude × K`.
  //   - 'multiplier': magnitude is a multiplier on a stat (Haste's Speed ×1.5).
  //     Amplified as `1 + (magnitude − 1) × K` so K scales the *bonus*, not the
  //     whole multiplier.
  // Only consulted when `amplifiable` is true.
  readonly magnitudeKind?: 'additive' | 'multiplier';
  readonly hooks: ReadonlyArray<StatusHookRegistration>;
  // AI-side metadata. See `StatusAiHints`.
  readonly aiHints?: StatusAiHints;
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
  // When `true`, Remedy (and any future debuff-cleanse consumer) will
  // NOT clear this status, even though its polarity is non-buff. Per
  // Chris's convention (Session 42): flat stat-reduction debuffs (PA /
  // MA / Speed / Brave / Faith Down) are not Remedy-clearable — they
  // express a committed, lasting weakening rather than a curable
  // ailment. Remedy still cures the classic ailments (Poison, Blind,
  // Silence, Sleep, Stop). Default `false` — every existing ailment
  // stays clearable. See ADR for the formula/Remedy changes.
  readonly remedyImmune?: boolean;
  // When `true`, this status overrides its wearer's *controller* (who picks
  // the unit's actions) without changing its `team` (roster / win-loss
  // membership). The reusable substrate behind Steal Heart's charm — the
  // `effectiveController` query returns the team named in the instance's
  // `customState.charmerTeam` while such a status is active, then reverts
  // automatically when it expires or breaks (computed, never stored — ground
  // rule 5). Future Confusion / Berserk consume the same flag with different
  // customState. v1 consumer: `enthralled` (the Thief's Steal Heart). Default
  // `false`.
  readonly controlOverride?: boolean;
  // When `true`, a unit carrying this status cannot have a control-override
  // applied to it — the engine-generic gate behind Steal Heart's post-charm
  // immunity. Validation rejects a control-override action against a target
  // holding any `controlOverrideImmune` status (checked via this flag, not a
  // content id, so the engine stays decoupled from specific content). v1
  // consumer: `heartwarded`. Default `false`.
  readonly controlOverrideImmune?: boolean;
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
