// Result types for status apply.
// See docs/design/status-effects.md ("Application pipeline").
//
// `applyStatus` returns a discriminated union describing what happened.
// The result becomes part of the originating action's outcome for the
// action log. The split between 'stacked' modes (independent vs
// additive) is internal granularity not enumerated by the design doc;
// they share the 'stacked' kind name and differ in `mode` so call sites
// that only care "did it stack?" can branch on `kind` while the
// lifecycle dispatch can branch on `mode`.

import type { StatusInstance } from '../types/index.ts';

export type StatusApplicationResult =
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
