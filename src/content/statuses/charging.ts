// Charging — paired with a ChargedAction in flight.
//
// Applied to the caster the instant a UseAbility with actionSpeed > 0
// commits; removed when the paired ChargedAction resolves or is
// canceled (KO / fizzle / dispel). The pair is bidirectional: the
// ChargedAction carries the casterId; the Charging instance carries
// the chargedActionId via `customState`.
//
// v1 hooks:
//
// - `queryTurnSkipped` — the caster sits idle while their spell is in
//   flight. Mirrors Stop's pattern (see content/statuses/stop.ts). The
//   reducer's `reduceTurnStart` reads the query, sets a zeroed budget,
//   marks `outcome.skipped: true`, and emits a `turn_end` immediately.
//   Per-unit-CT statuses skip their tick on the skipped turn (Charging
//   itself has `conditional` duration so isn't time-ticked anyway).
//
// Future content can add hooks freely: e.g., a "perfect-hit-on-Charging"
// ability would register an `onActionAttempted` handler against the
// caster, or a "counterspell"-style ability would target the
// ChargedAction entity directly through the projection queue. Both
// pathways already exist; nothing else needs to change here.
//
// Stacking: REJECT. A single caster can only have one ChargedAction
// outstanding at a time in v1 (no "double-cast" or "queue spells"
// content). If a second charged spell were committed while Charging
// is active, validation should already reject it (no actsAvailable on
// a turn where the caster is being skipped); REJECT here is the
// belt-and-suspenders backstop.
//
// Duration: `conditional` — never time-ticks. The lifecycle is driven
// entirely by the paired ChargedAction's resolution (or by an
// interruption that fizzles the ChargedAction).

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const charging: StatusEffectType = {
  id: statusTypeId('charging'),
  name: 'Charging',
  tags: ['neutral', 'time'],
  durationMode: 'conditional',
  stackingRule: 'REJECT',
  hooks: [
    statusHook('queryTurnSkipped', () => ({ reason: 'charging' })),
  ],
};
