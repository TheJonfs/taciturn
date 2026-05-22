// Flow State — Water Mage's Support.
//
// After this unit takes a UseAbility whose tags include `'magical'`, a
// system_ct_push of +10 fires against this unit. First content consumer
// of the `onActionResolved` hook (added session 18; closed surface 12 →
// 13). Gates on the ability's top-level `tags` array — the omission of
// `'magical'` from Cure was fixed in session 18 alongside this ability
// so White Magic costs benefit from the refund consistently.
//
// Per session 18 plaintext review:
//   - baseCost 1, refund 10 CT, gates on `'magical'` tag
//   - fires only on resolved actions (charged spells refund at the
//     resolve step, not at the commit/charge step — the hook fires
//     post-resolution from both reduceUseAbility and reduceChargedActionResolve)
//
// Tactical comparison vs. Earth Communion: Communion modifies status
// chance (×1.25 multiplier on the BMG application formula). Flow State
// operates on the CT economy — repeated magic casts pile up CT savings,
// supporting a "stay in front of the action queue" build.

import {
  abilityId,
  bucketId,
  passiveHook,
  type OnActionResolvedResult,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const FLOW_STATE_REFUND = 10;

export const flowState: PassiveAbilityDefinition = {
  id: abilityId('flow_state'),
  name: 'Flow State',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'water'],
  hooks: [
    passiveHook('onActionResolved', (args, ctx): OnActionResolvedResult => {
      // Gate on the ability's `'magical'` tag. Non-magical actions
      // (Knight attacks, Move, Wait, etc.) don't refund.
      if (args.ability === null) return {};
      if (!(args.ability.tags ?? []).includes('magical')) return {};
      return {
        emittedActions: [
          {
            type: 'system_ct_push',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              delta: FLOW_STATE_REFUND,
              source: {
                kind: 'support',
                abilityId: ctx.ability.id,
                unitId: args.unit.id,
              },
            },
          },
        ],
      };
    }),
  ],
};
