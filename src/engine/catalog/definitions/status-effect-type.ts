// StatusEffectType — the catalog definition of a kind of status effect.
// See docs/design/status-effects.md ("Status type and instance").
//
// The instance lives on a unit (engine/types/status.ts); the type lives
// here in the catalog and carries everything universal: tags, duration
// mode, stacking rule, default magnitude, and hook handlers.

import type { DamageTag, DurationMode, StackingRule, StatusTag, StatusTypeId } from '../../types/index.ts';
import type { StatusHookRegistration } from '../../status/hooks.ts';

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
}
