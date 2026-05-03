// AbilityDefinition — the catalog definition of an ability.
// See docs/design/ability-slots.md and docs/design/action-resolution.md.
//
// Minimal session-2 shape. Session 5 adds cost/bucket/learning fields,
// session 7 adds the action payload and effect specification, session 8
// the damage parameters.

import type { AbilityId } from '../../types/index.ts';

export interface AbilityDefinition {
  readonly id: AbilityId;
  readonly name: string;
}
