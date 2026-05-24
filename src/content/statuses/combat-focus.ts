// Combat Focus — Alchemist Reaction effect (Session 39b; S50 lifecycle
// fix).
//
// +1 PA per enemy hit, permanent (in-battle), stacks via REFRESH onto
// magnitude (each trigger increments the single instance's magnitude
// by +1 rather than appending a new STACK_INDEPENDENT stack).
//
// S50: pre-S50 this was `'turn_based'` / 3-turn duration with REFRESH
// (re-trigger reset the timer; magnitude stayed at +1). Chris's
// playtest flagged the 3-turn limit as the wrong shape — Combat Focus
// is the Alchemist's parallel to Speed Save (Assassin / Speed), Updraft
// (Hunter / Jump), and Cornered Focus (Calculator / MA). Those three
// are all `'permanent'` with STACK_ADDITIVE so the buff ratchets up
// across the battle as the unit takes hits. Combat Focus now lives in
// the same family on the PA axis — `'permanent'` so the buff doesn't
// expire, REFRESH-into-magnitude so each new trigger adds +1 to the
// running count on the single instance. Existing Reaction emission
// shape (apply_status with magnitude 1) flows through unchanged.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const combatFocus: StatusEffectType = {
  id: statusTypeId('combat_focus'),
  name: 'Combat Focus',
  tags: ['positive', 'time'],
  durationMode: 'permanent',
  stackingRule: 'STACK_ADDITIVE',
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
