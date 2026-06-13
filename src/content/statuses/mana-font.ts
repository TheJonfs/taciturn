// Mana Font — battle-long per-turn MP regeneration. The MP analog of
// `regen_auto` (Session 65): same equipment-grant lifecycle, but it
// restores MP rather than HP. First (and only) consumer is the Circlet,
// which grants it at battle start.
//
//   amount = floor(MA_recipient / 2)
//
// MA reads the *recipient's* MA through `runModifyStatQuery`, so the
// regen scales with the wearer's live MA (base + Circlet's +1 + any
// buffs), mirroring how Regen reads the recipient's Faith/MaxHP. The
// tick rides the recipient's CT cadence (once per turn, effectively),
// emitting a `system_mp_restore` capped at the wearer's maxMp.
//
// Lifecycle: `permanent_per_unit_ct` — no time expiry, so the
// equipment-grant pipeline can apply it without a duration argument
// (the same reason regen_auto split from cast regen — see regen-auto.ts).
// Stop's `suppressStatusTicks` halts it on a frozen turn, which is
// correct: a Stopped caster regains no MP that turn.
//
// Tuned alongside the S65 MP rebaseline: the four elemental mages dropped
// 60 → 48 and Calculator 47 → 37, so this regen (MA/2 ≈ +6 for a 12-MA
// mage, +4 for the Calculator) is a real sustain choice rather than
// topping off an already-bottomless pool.

import {
  runModifyStatQuery,
  statusHook,
  statusTypeId,
  type OnTickResult,
  type StatusEffectType,
} from '@engine/index.ts';

export const manaFont: StatusEffectType = {
  id: statusTypeId('mana_font'),
  name: 'Mana Font',
  tags: ['positive'],
  durationMode: 'permanent_per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('onTick', (args): OnTickResult => {
      // KO'd targets don't regen (vitals frozen while KO'd). Mirrors
      // Regen's belt-and-suspenders gate; the scheduler already routes
      // KO'd units to system_ko_tick, but the gate covers replay paths.
      const target = args.state.units.get(args.unit.id);
      if (target === undefined || target.vitals.hp <= 0) return {};
      const ma = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'ma',
        baseValue: args.unit.baseStats.ma,
      });
      const amount = Math.floor(ma / 2);
      if (amount <= 0) return {};
      return {
        emittedActions: [
          {
            type: 'system_mp_restore',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount,
              source: {
                kind: 'status_tick',
                statusTypeId: args.statusTypeId,
                unitId: args.unit.id,
              },
            },
          },
        ],
      };
    }),
  ],
};
