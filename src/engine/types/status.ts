// Status instance — per-unit application of a status type.
//
// Placeholder shape for session 1: only the type reference is fixed.
// Full StatusInstance fields (source, duration, magnitude, stacks)
// land in session 3 alongside the hook system.
// See docs/design/status-effects.md.

import type { StatusTypeId } from './ids.ts';

export interface StatusInstance {
  readonly typeId: StatusTypeId;
}
