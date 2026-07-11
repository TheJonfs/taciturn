// Golden Rod's Pact — the Faustian countdown (TABA Ch3 unique).
//
// Granted by the Golden Rod via equipment `statusGrants` (the Boots of
// Haste path — applied at battle start, equipment-sourced, removable
// only by unequipping). Every turn start, the wielder pays the pact and
// takes the power:
//
//   - HP: −floor(10% of effective MaxHP), via `system_damage` (Burn's
//     tick channel). LETHAL BY RULING — the drain can and should KO an
//     unsupported wielder (~10 turns from full, faster after chip
//     damage). The forced sustain pairing (a healer, Star Robe
//     lifesteal, Auto-Regen) IS the design.
//   - MP: −floor(10% of effective MaxMP), via a NEGATIVE
//     `system_mp_restore` (the signed extension shipped with this
//     status; `system_mp_drain` is a transfer and can't model a
//     one-sided burn). Floors at 0 MP — the mana dries up, it doesn't
//     go negative.
//   - +1 MA: one Gilded Focus stack (permanent, accumulating).
//
// LINEAR ruling (load-bearing): the drain is 10% OF MAX each turn —
// flat, not compounding on current. Read fresh off modifyStatQuery each
// tick so equipment/status MaxHP shifts track correctly (rule 5 — no
// caching).
//
// Cadence: `permanent_per_unit_ct` — onTick fires at the wielder's
// CT-100 boundary (regen_auto's lifecycle), which IS the start-of-turn
// trigger. KO'd wielders don't tick (ADR-0079 gate, mirrors Regen/Burn).
// remedyImmune belt-and-suspenders: the pact is the weapon's cost, not
// a cleansable ailment (equipment-sourced statuses already resist
// removal per ADR-0028).

import {
  runModifyStatQuery,
  statusHook,
  statusTypeId,
  type OnTickResult,
  type StatusEffectType,
} from '@engine/index.ts';

const DRAIN_FRACTION = 0.1;

export const goldenRodPact: StatusEffectType = {
  id: statusTypeId('golden_rod_pact'),
  name: "Golden Rod's Pact",
  tags: ['negative'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  remedyImmune: true,
  aiHints: { polarity: 'debuff' },
  hooks: [
    statusHook('onTick', (args, ctx): OnTickResult => {
      void ctx;
      const wielder = args.state.units.get(args.unit.id);
      if (wielder === undefined || wielder.vitals.hp <= 0) return {};
      const maxHp = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'maxHp',
        baseValue: args.unit.baseStats.maxHpBase,
      });
      const maxMp = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'maxMp',
        baseValue: args.unit.baseStats.maxMpBase,
      });
      const hpDrain = Math.floor(DRAIN_FRACTION * maxHp);
      const mpBurn = Math.floor(DRAIN_FRACTION * maxMp);
      const tickSource = {
        kind: 'status_tick',
        statusTypeId: args.statusTypeId,
        unitId: args.unit.id,
      } as const;
      return {
        emittedActions: [
          // The power lands first (the wielder is alive at turn start by
          // construction); then the pact collects.
          {
            type: 'system_apply_status',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              statusTypeId: statusTypeId('gilded_focus'),
              sourceUnitId: args.unit.id,
            },
          },
          {
            type: 'system_damage',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount: hpDrain,
              tags: [],
              source: tickSource,
            },
          },
          {
            type: 'system_mp_restore',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount: -mpBurn,
              source: tickSource,
            },
          },
        ],
      };
    }),
  ],
};
