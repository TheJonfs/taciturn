// StatusApplicationOutcome — the structured result of one apply attempt.
// See docs/design/status-effects.md ("Application pipeline") and
// engine/status/apply.ts for how it's produced.
//
// Lives in `engine/types/` (rather than `engine/status/`) because action
// outcomes reference it: an UseAbility's per-target result can include
// the list of statuses applied (or rejected) to that target. Putting the
// type here keeps the engine/types → engine/status arrow correct.

import type { StatusInstance } from './status.ts';

export type StatusApplicationOutcome =
  | { readonly kind: 'applied'; readonly instance: StatusInstance }
  | { readonly kind: 'refreshed'; readonly instance: StatusInstance }
  | {
      readonly kind: 'replaced';
      readonly previousInstance: StatusInstance;
      readonly instance: StatusInstance;
    }
  | {
      readonly kind: 'stacked';
      readonly mode: 'independent' | 'additive';
      readonly instance: StatusInstance;
    }
  | { readonly kind: 'resisted' }
  | { readonly kind: 'rejected'; readonly reason: 'stacking_rule' };
