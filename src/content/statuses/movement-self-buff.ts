// Movement Self-Buff (Earth) — boosts the wearer's Move Range. The
// companion of Movement Debuff. Earth Resilience (Landwalker) emits
// this when triggered.
//
// Per session 16 plaintext review: kept as a *separate type* from
// Movement Debuff because (a) tag polarity differs (positive vs.
// negative; relevant for Dispel-style mechanics), (b) the buff and
// debuff should compose to a net 0 when both are present rather than
// REFRESH each other off.
//
// S48: scoped to Move only — the Jump component was removed to keep
// Landwalker (Geosage Reaction) symmetric with the Hunter's Updraft
// (Jump-only) and Assassin's Speed Save (Speed-only) stacking-reaction
// pattern. Each Reaction now buffs exactly one mobility axis.
//
// Stacking: STACK_INDEPENDENT — each Earth Resilience trigger creates
// a new instance with its own duration, contributing +1 Move each.
// With three triggers active, the unit has +3 Move; each instance
// expires on its own timer (6 CT default), bounding total stacking by
// trigger frequency × duration.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const movementSelfBuff: StatusEffectType = {
  id: statusTypeId('movement_self_buff'),
  name: 'Earthen Resolve',
  tags: ['positive', 'earth'],
  durationMode: 'per_unit_ct',
  stackingRule: 'STACK_INDEPENDENT',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'moveRange') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
