// Momentum — the Thief's Support. The mirror of the Water Mage's Flow State:
// after this unit takes a *non-magical* action, a `system_ct_push` of +10
// fires against it. Where Flow State refunds CT on magical casts, Momentum
// refunds it on everything else — the basic Attack included.
//
// The gate is the clean inverse of Flow State's `'magical'`-tag check:
//   - `args.ability === null` (Move, Wait, Set Facing) → no refund. Pure
//     positioning / passing isn't an "action" for tempo purposes, and
//     refunding CT on Wait would be degenerate.
//   - ability present + NOT `'magical'`-tagged → refund. Basic Attack
//     (ability `attack`, untagged) qualifies, as do the Steal arts.
//   - `'magical'`-tagged ability (a cross-classed spell) → no refund.
//
// Including the basic Attack is deliberate (concept-notes): it makes the
// Thief's MP-conservation / Steal-Heart-banking turns tempo-productive rather
// than dead, without devaluing the steals (which also refund). Magnitude
// matches Flow State (10).
//
// Watch-for (concept-notes): Momentum fires more often than Flow State
// (every non-magical action vs only magical casts), so a basic-Attack refund
// could compound tempo — keep an eye on runaway turn economy; 10 is the
// spec's "match Flow State" starting point, droppable if it snowballs.

import {
  abilityId,
  bucketId,
  passiveHook,
  type OnActionResolvedResult,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

const MOMENTUM_REFUND = 10;

export const momentum: PassiveAbilityDefinition = {
  id: abilityId('momentum'),
  name: 'Momentum',
  kind: 'passive',
  bucket: bucketId('support'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('onActionResolved', (args, ctx): OnActionResolvedResult => {
      // Inverse of Flow State: refund on a non-magical *action*. Move / Wait
      // (null ability) don't refund; magical-tagged abilities don't either.
      if (args.ability === null) return {};
      if ((args.ability.tags ?? []).includes('magical')) return {};
      return {
        emittedActions: [
          {
            type: 'system_ct_push',
            source: 'system',
            payload: {
              targetId: args.unit.id,
              delta: MOMENTUM_REFUND,
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
