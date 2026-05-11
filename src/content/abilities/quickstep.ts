// Quickstep — Lightning Mage's class-free Movement passive.
//
// onTurnEnd handler (per ADR-0053, session 26): if the unit committed
// at least one Move action during the turn, emits a `system_ct_push`
// of +MA against itself. Effect is "moving costs you less of the queue."
// Mirrors Flow State's onActionResolved-refund pattern but on the Move
// axis: Lightning's mobility identity buys back queue position.
//
// MA is queried via `runModifyStatQuery` so statuses / equipment / other
// passives that modify MA compose correctly (e.g., a future MA buff
// equipment would inflate the refund proportionally). At Lightning Mage's
// L25 baseline MA = 8 (per current demo battle config), a Move-only turn
// refunds 8 CT — meaningful but not transformative; chained with Hotfoot
// or Haste the unit can re-enter the queue notably faster.
//
// Once-per-turn semantics: the emission gates on `consumed.movesConsumed
// > 0` (a count), so multiple Moves in the same turn still produce only
// one refund (onTurnEnd fires once per turn boundary).
//
// Cost-1 in v1: cheap, narrowly applicable to Move-committed turns.

import {
  abilityId,
  bucketId,
  passiveHook,
  runModifyStatQuery,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

export const quickstep: PassiveAbilityDefinition = {
  id: abilityId('quickstep'),
  name: 'Quickstep',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  tags: ['lightning'],
  hooks: [
    passiveHook('onTurnEnd', (args, ctx) => {
      const turnState = args.state.turnState;
      if (turnState === null) return { emittedActions: [] };
      if (turnState.consumed.movesConsumed === 0) return { emittedActions: [] };
      const ma = runModifyStatQuery(args.state, args.catalog, {
        unit: args.unit,
        statName: 'ma',
        baseValue: args.unit.baseStats.ma,
      });
      if (ma <= 0) return { emittedActions: [] };
      const refund: ProposedAction = {
        type: 'system_ct_push',
        source: 'system',
        payload: {
          targetId: args.unit.id,
          delta: ma,
          source: {
            kind: 'support',
            abilityId: ctx.ability.id,
            unitId: args.unit.id,
          },
        },
      };
      return { emittedActions: [refund] };
    }),
  ],
};
