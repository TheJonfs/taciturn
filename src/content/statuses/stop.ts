// Stop — the canonical session-9 turn-skip status. Registers a
// `queryTurnSkipped` handler that returns `{ reason: 'stopped' }` while
// active. It also sets `suppressesReactions` (ADR-0131): a Stopped unit
// is frozen in time — it neither takes its turn NOR fires reactions
// (Counter, Damage Split, etc.). The turn half and the reaction half
// together match FFT's Stop. The reducer (`reduceTurnStart`) reads the query, sets up a
// minimal turnState with zeroed budget, marks the outcome `skipped:
// true`, and emits a `turn_end` as a generated action. The unit's
// per-unit-CT statuses skip their tick this turn; turn-based statuses
// still tick at turn_end (as designed — Stop's own duration is part of
// what's ticking down).
//
// Per-unit-CT duration mode keeps the cadence FFT-faithful: a Stopped
// unit that's also Slowed sees its Stop tick slower along with
// everything else. (Stop with `turn_based` duration would over-tick
// because the skipped turn still fires turn_end and decrements turn-
// based statuses; per-unit-CT is the right mode for Stop in v1.)

import { statusHook, statusTypeId, type StatusEffectType } from '@engine/index.ts';

export const stop: StatusEffectType = {
  id: statusTypeId('stop'),
  name: 'Stop',
  tags: ['negative', 'time', 'mental'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'debuff', value: 40 },
  // Frozen in time: a Stopped unit fires no reactions (Counter, Damage
  // Split, Discharge, etc.). This is the reaction half of FFT's Stop;
  // `queryTurnSkipped` below is the turn half. Gated uniformly at
  // `runOnActionTargeted`. Per ADR-0131. (Contrast Don't Act, which
  // allows reactions.)
  suppressesReactions: true,
  hooks: [
    statusHook('queryTurnSkipped', () => ({
      reason: 'stopped',
      // Stop is "frozen in time" — per-unit-CT statuses (Poison, Regen,
      // Burn) skip their tick on a Stopped turn. Per ADR-0024.
      suppressStatusTicks: true,
    })),
  ],
};
