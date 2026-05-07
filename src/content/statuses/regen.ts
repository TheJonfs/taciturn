// Regen — heal-over-time tied to the recipient's CT cadence.
//
// Per session 16 plaintext review:
//   amount = floor((Faith_target / 100) × 0.10 × MaxHP_target)
//
// Faith here reads the *recipient's* faith (not the original caster's
// faith). The intent is "as the recipient gets faithier, the buff sticks
// harder"; design is comfortable with this asymmetry — Regen is a
// recipient-modulated effect, not a caster-modulated one. Most v1
// statuses use the symmetric Faith pipeline (status application chance);
// Regen's tick is a per-tick local computation.
//
// MaxHP scaling lets Regen stay relevant across HP ranges. At 80 Faith:
//   MaxHP  50  → 4 HP / tick
//   MaxHP 100  → 8 HP / tick
//   MaxHP 300  → 24 HP / tick
//
// Duration: per_unit_ct, 36 CT-units default — about 4-5 ticks at the
// recipient's base Speed. Stacks via REFRESH (re-application resets
// duration; magnitude/Faith-anchor stays at the type defaults).
//
// Tick mechanism: status_tick fires onTick (per ADR-0024); Regen's
// onTick handler computes the amount via runModifyStatQuery for Faith
// and MaxHP, then emits a `system_heal` action. The chain processor
// commits the heal after the status_tick lands.

import {
  runModifyStatQuery,
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const REGEN_COEFFICIENT = 0.10;

export const regen: StatusEffectType = {
  id: statusTypeId('regen'),
  name: 'Regen',
  tags: ['positive'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  hooks: [
    statusHook('onTick', (args) => {
      const faith = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'faith',
        baseValue: args.unit.baseStats.faith,
      });
      const maxHp = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'maxHp',
        baseValue: args.unit.baseStats.maxHpBase,
      });
      const amount = Math.floor((faith / 100) * REGEN_COEFFICIENT * maxHp);
      if (amount <= 0) {
        return {};
      }
      return {
        emittedActions: [
          {
            type: 'system_heal',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount,
              tags: ['healing'],
              source: { kind: 'status_tick', statusTypeId: args.statusTypeId, unitId: args.unit.id },
            },
          },
        ],
      };
    }),
  ],
};
