// StatusEffectType — the catalog definition of a kind of status effect.
// See docs/design/status-effects.md.
//
// Minimal session-2 shape: identity only. Session 3 adds the meaningful
// fields (tags, default magnitude, duration mode, stacking rule, hook
// handlers) when the hook system lands.

import type { StatusTypeId } from '../../types/index.ts';

export interface StatusEffectType {
  readonly id: StatusTypeId;
  readonly name: string;
}
