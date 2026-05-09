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
  | 'permanent' // never removed except explicitly
  | 'permanent_per_unit_ct' // ticks at unit CT cadence but never expires
  | 'custom'; // lifecycle is event-driven, not time-driven (see customTrigger)
// `permanent_per_unit_ct` (ADR-0027): the orthogonal product of `per_unit_ct`
// (cadence — onTick fires at every CT-100 trigger of the affected unit)
// and `permanent` (no expiry — `remainingDuration` is null and never
// decrements). v1's first consumer is non-expiring Poison, where the
// design intent is "ticks until removed by ability/item, not by time."
//
// `custom` (ADR-0030): the status's lifecycle is driven by the
// `customTrigger` field on its StatusEffectType, not by time decrement.
// `remainingDuration` is null and never decrements. The trigger event
// (declared in customTrigger.kind) maps to an existing engine hook —
// `'on_unit_ct_100'` rides the per-unit-CT status_tick → onTick path,
// and the customStateOnDecrement type-method handles per-stack metadata
// when the status's onTick handler emits status_decrement_stack. v1
// consumer is Burn; session 20's Vulnerable adds `'on_damage_received'`.
