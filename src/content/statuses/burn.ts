// Burn (Fire) — custom-trigger DoT with per-stack MA-derived damage.
//
// Per session 19 plaintext review and ADR-0030: Burn doesn't decay by
// time. Each application snapshots the applier's MA at apply time into
// a per-stack damage value (`floor(MA × BURN_COEFFICIENT)`). On the
// affected unit's CT-100 trigger, the status sums all per-stack values,
// emits `system_damage`, then FIFO-shifts one value off and decrements
// the count. When the count reaches 0, the instance is removed.
//
// Mixed-source resilience: each stack remembers its applier's MA. A
// high-MA Fire Mage's stacks hit hard for the rest of their lifetime
// even if a different applier (lower MA) tops up the stacks; only the
// new stacks carry the lower value. The applier's later MA shifts don't
// retroactively change earlier stacks.
//
// FIFO drop: the first stack added drops first. The newest applier's
// contribution outlives earlier stacks — rewards continued application
// from a strong applier (their latest stack persists longest), and
// matches the "fading flame" mental model.
//
// At MA 9 (Fire Mage baseline): 5 dmg / stack. Three stacks: 5, 5, 5
// over three triggers (15 total damage; tempo of three turn-starts).
// Spark (2 stacks) on a Knight at 60 HP from a Fire Mage at MA 9 →
// 10 + 5 = 15 damage over two triggers; ~25% HP toll over two turns.

import {
  runModifyStatQuery,
  runModifyStatusTickAmount,
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

const BURN_COEFFICIENT = 0.6;

interface BurnCustomState extends Readonly<Record<string, unknown>> {
  // Per-stack damage values, length always equals the instance's `stacks`.
  // Snapshot from the applier's MA at apply time. FIFO drop on each
  // CT-100 trigger via customStateOnDecrement.
  readonly stackDamages: ReadonlyArray<number>;
}

function readStackDamages(
  customState: Readonly<Record<string, unknown>> | undefined,
): ReadonlyArray<number> {
  if (customState === undefined) return [];
  const sd = (customState as BurnCustomState).stackDamages;
  return Array.isArray(sd) ? sd : [];
}

export const burn: StatusEffectType = {
  id: statusTypeId('burn'),
  name: 'Burn',
  tags: ['negative', 'fire', 'dot'],
  durationMode: 'custom',
  customTrigger: { kind: 'on_unit_ct_100' },
  stackingRule: 'STACK_COUNT_ADDITIVE',
  resistanceTag: 'fire',

  // Per ADR-0030: snapshot the applier's MA into N copies (where N is
  // the requested stack quantity), append to existing stacks, and
  // return the merged customState plus the resulting stack count.
  composeApplyState: ({ state, catalog, caster, existingInstance, requestedStackQuantity }) => {
    const ma =
      caster !== null
        ? runModifyStatQuery(state, catalog, {
            unit: caster,
            statName: 'ma',
            baseValue: caster.baseStats.ma,
          })
        : 0;
    const perStackDamage = Math.max(1, Math.floor(ma * BURN_COEFFICIENT));
    const newStackValues = Array.from({ length: requestedStackQuantity }, () => perStackDamage);
    const existingStackValues = readStackDamages(existingInstance?.customState);
    const merged = [...existingStackValues, ...newStackValues];
    return {
      customState: { stackDamages: merged } as BurnCustomState,
      stacks: merged.length,
    };
  },

  // Per ADR-0030: FIFO-shift the oldest stack's damage value when the
  // generic decrement fires. The count decrement is handled by the
  // generic `status_decrement_stack` reducer; this method only updates
  // the customState.
  customStateOnDecrement: (instance) => {
    const stackDamages = readStackDamages(instance.customState);
    if (stackDamages.length === 0) return instance.customState;
    return { ...instance.customState, stackDamages: stackDamages.slice(1) } as BurnCustomState;
  },

  hooks: [
    // CT-100 trigger fires via the per-unit-CT status_tick fan-out
    // (because `customTrigger.kind === 'on_unit_ct_100'`). The onTick
    // handler computes the damage sum, emits `system_damage` plus
    // one or more `status_decrement_stack` actions. The reducer skips
    // the duration decrement for `'custom'` mode, so the lifecycle is
    // fully driven by these emissions.
    //
    // Per ADR-0060 (Session 28): `modifyStatusTickAmount` scales the
    // stack-consumption rate. Default chain product = 1 (one stack
    // consumed per tick, preserving baseline Burn behavior). Purifier
    // ×2 on `'negative'`-tagged statuses bumps the chain product to 2;
    // Burn responds by emitting 2 decrement actions per tick — same
    // per-tick damage, but the diminishing-damage profile (28, 21, 14,
    // 7 → 28, 14) collapses in half the ticks. Net less total damage,
    // which matches Purifier's design intent (counter-pick for the
    // wearer against status-spread strategies).
    statusHook('onTick', (args) => {
      const target = args.state.units.get(args.unit.id);
      if (target === undefined || target.vitals.hp <= 0) {
        // KO'd targets don't tick (BMG: "DoT statuses do not tick while
        // KO'd"). The CT scheduler already filters KO'd units, but
        // belt-and-suspenders for replay edge cases.
        return {};
      }
      const instance = target.statuses.find((s) => s.typeId === args.statusTypeId);
      if (instance === undefined) return {};
      const stackDamages = readStackDamages(instance.customState);
      if (stackDamages.length === 0) return {};
      const total = stackDamages.reduce((sum, v) => sum + v, 0);
      const burnType = args.catalog.getStatusType(args.statusTypeId);
      const tickAmountRaw = runModifyStatusTickAmount(args.state, args.catalog, {
        unit: target,
        statusTypeId: args.statusTypeId,
        statusTags: burnType.tags,
        baseAmount: 1,
      });
      // Cap at the remaining stack count so we don't emit more
      // decrements than there are stacks (each decrement is a
      // discrete action; the reducer handles the case where a
      // decrement fires against zero stacks, but cleaner to gate here).
      const decrementCount = Math.max(
        1,
        Math.min(stackDamages.length, Math.floor(tickAmountRaw)),
      );
      const decrementActions = Array.from({ length: decrementCount }, () => ({
        type: 'status_decrement_stack' as const,
        source: 'system' as const,
        payload: { targetId: args.unit.id, statusTypeId: args.statusTypeId },
      }));
      return {
        emittedActions: [
          {
            type: 'system_damage',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              amount: total,
              tags: ['fire', 'dot'],
              source: {
                kind: 'status_tick',
                statusTypeId: args.statusTypeId,
                unitId: args.unit.id,
              },
            },
          },
          ...decrementActions,
        ],
      };
    }),
  ],
};
