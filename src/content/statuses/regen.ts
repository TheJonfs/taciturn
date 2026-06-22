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
  type OnTickResult,
  type StatusEffectType,
  type StatusHookRegistration,
} from '@engine/index.ts';

const REGEN_COEFFICIENT = 0.10;

// Shared onTick handler — used by both `regen` (timed cast) and
// `regen_auto` (battle-long Auto-Regen via Tintinibar). Per Session 31:
// the two share lifecycle/duration semantics but not the heal formula,
// so the formula lives in one place.
//
// S72 (ADR-0122): the per-tick amount now scales by the instance magnitude (a
// coefficient, default 1 ⇒ unchanged), so a caster-side amplifier (Aura
// Mastery) can deepen *cast* Regen. `regen_auto` keeps magnitude 1 (it's not
// amplifiable), so equipment Auto-Regen is bit-identical to before.
export const regenOnTick: StatusHookRegistration = statusHook('onTick', (args, ctx): OnTickResult => {
  // Per ADR-0079: KO'd targets don't tick. Cast Regen (`per_unit_ct`)
  // clears at KO via the KO-clear sweep, so under normal flow this gate
  // is only load-bearing for `regen_auto` (`permanent_per_unit_ct`,
  // persists through KO). The scheduler already routes KO'd units to
  // `system_ko_tick` instead of `turn_start`, but the gate is
  // belt-and-suspenders for replay / edge paths. Mirrors Burn's gate.
  const target = args.state.units.get(args.unit.id);
  if (target === undefined || target.vitals.hp <= 0) return {};
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
  const magnitude = ctx.instance.magnitude ?? 1;
  const amount = Math.floor((faith / 100) * REGEN_COEFFICIENT * magnitude * maxHp);
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
});

export const regen: StatusEffectType = {
  id: statusTypeId('regen'),
  name: 'Regen',
  tags: ['positive'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  // Coefficient scalar on the per-tick heal (default 1 = current behavior).
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  // Aura Mastery amplifies cast Regen (Life from the Loam; ADR-0122). magnitude
  // is the heal coefficient (additive kind): 1 → 1×K deepens the heal-over-time.
  amplifiable: true,
  hooks: [regenOnTick],
};
