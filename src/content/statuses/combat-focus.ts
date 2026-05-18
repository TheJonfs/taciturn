// Combat Focus — Alchemist Reaction effect (Session 39b).
//
// +1 PA for 3 turns, refreshes on re-trigger (does not stack). Distinct
// from the existing `pa_up` status (permanent, STACK_ADDITIVE, used by
// Fire Embrace as a battle-long buff): this one is the temporary
// adrenaline-kicks-in flavor of getting hit. Same +PA composition
// shape via `modifyStatQuery`, different lifecycle.
//
// Per S39 brief D4: +1 magnitude, 3 turns, REFRESH semantics. The
// Reaction's `apply_status` effect re-applies on each trigger; REFRESH
// resets duration to 3 without stacking magnitude.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const combatFocus: StatusEffectType = {
  id: statusTypeId('combat_focus'),
  name: 'Combat Focus',
  tags: ['positive'],
  durationMode: 'turn_based',
  stackingRule: 'REFRESH',
  defaultMagnitude: 1,
  aiHints: { polarity: 'buff' },
  hooks: [
    statusHook('modifyStatQuery', (args, ctx) => {
      if (args.statName !== 'pa') return args.baseValue;
      const magnitude = ctx.instance.magnitude ?? 1;
      return args.baseValue + magnitude;
    }),
  ],
};
