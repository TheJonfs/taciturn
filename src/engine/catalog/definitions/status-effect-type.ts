// StatusEffectType — the catalog definition of a kind of status effect.
// See docs/design/status-effects.md ("Status type and instance").
//
// The instance lives on a unit (engine/types/status.ts); the type lives
// here in the catalog and carries everything universal: tags, duration
// mode, stacking rule, default magnitude, and hook handlers.

import type { DurationMode, StackingRule, StatusTag, StatusTypeId } from '../../types/index.ts';
import type { StatusHookRegistration } from '../../status/hooks.ts';

export interface StatusEffectType {
  readonly id: StatusTypeId;
  readonly name: string;
  readonly tags: ReadonlyArray<StatusTag>;
  readonly durationMode: DurationMode;
  readonly stackingRule: StackingRule;
  readonly defaultMagnitude?: number;
  readonly hooks: ReadonlyArray<StatusHookRegistration>;
}
