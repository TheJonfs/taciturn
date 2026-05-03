// Duration modes — how a status instance's `remainingDuration` decreases.
// Per-status declaration on the StatusEffectType.
// See docs/design/status-effects.md ("Duration modes").
//
// Session 3 stores the mode and the initial duration but does not actually
// tick anything — the turn loop (session 9) and tick events handle decrement.

export type DurationMode =
  | 'global_ticks' // engine-wide tick counter; for environmental effects
  | 'per_unit_ct' // affected unit's CT cadence; FFT default for unit statuses
  | 'turn_based' // affected unit's turns
  | 'conditional' // until a predicate fires; never decremented by time
  | 'permanent'; // never removed except explicitly
