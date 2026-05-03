// Re-export of `StatusApplicationOutcome` under its session-3 name.
// See engine/types/status-application-outcome.ts for the canonical
// definition; the type was promoted to `engine/types/` in session 7 so
// action outcomes can reference it without a layering reversal.

export type { StatusApplicationOutcome as StatusApplicationResult } from '../types/index.ts';
