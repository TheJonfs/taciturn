// Poison — non-expiring damage-over-time. Ticks at the affected unit's
// CT cadence; never decrements duration (cleared only by ability/item
// or the unit's KO).
//
// Per session 17b plaintext review:
//   amount = floor(MaxHP_target × 0.10)
//
// Damage is sourced from the *recipient's* MaxHP, not the original
// caster's stats. Poison "feeds on" the host: the bigger the host, the
// bigger the tick. Faith does not enter the per-tick formula (per the
// session 17b decision — "the damage tag composition" agreement). The
// tick bypasses the seven-stage damage pipeline entirely; resistance
// comparisons would be one-shot, not per-tick.
//
// At MaxHP 60 (Knight): 6 HP / tick — 10 ticks to KO from full.
// At MaxHP 100: 10 HP / tick.
// At MaxHP 300: 30 HP / tick.
//
// Duration: `permanent_per_unit_ct` (ADR-0027) — ticks at the recipient's
// CT but never expires. Stacks via REFRESH (re-application is a no-op
// since duration doesn't decay; subsequent applications find the existing
// instance and refresh nothing meaningful).
//
// Tick mechanism: status_tick fires onTick (per ADR-0024); Poison's
// onTick handler computes the amount via runModifyStatQuery for MaxHP,
// then emits a `system_damage` action (per ADR-0027). The chain processor
// commits the damage after the status_tick lands. Reactions (Counter)
// do not trigger from system_damage — Poison damage is a status side
// effect, not an attack.

import {
  runModifyStatQuery,
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const POISON_COEFFICIENT = 0.10;

export const poison: StatusEffectType = {
  id: statusTypeId('poison'),
  name: 'Poison',
  tags: ['negative', 'poison'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  hooks: [
    statusHook('onTick', (args) => {
      const maxHp = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'maxHp',
        baseValue: args.unit.baseStats.maxHpBase,
      });
      const amount = Math.floor(maxHp * POISON_COEFFICIENT);
      if (amount <= 0) {
        return {};
      }
      return {
        emittedActions: [
          {
            type: 'system_damage',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount,
              tags: ['poison'],
              source: { kind: 'status_tick', statusTypeId: args.statusTypeId, unitId: args.unit.id },
            },
          },
        ],
      };
    }),
  ],
};
