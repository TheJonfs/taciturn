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
  | {
      readonly kind: 'rejected';
      // 'stacking_rule' — a same-type REJECT rule. 'exclusivity_group' — a
      // different-typed sibling in the same exclusivity group already holds
      // the slot (S74, ADR-0124).
      readonly reason: 'stacking_rule' | 'exclusivity_group';
    }
  // Application chance roll failed — `chance` is the computed
  // post-modifier value in [0, 1], `roll` is the unit float drawn from
  // the seed. The status was not applied. Emitted by the status
  // application formula path (ability-driven applications); the auto-
  // apply path (Charging via commitCharged) doesn't roll.
  | {
      readonly kind: 'missed';
      readonly chance: number;
      readonly roll: number;
    };
