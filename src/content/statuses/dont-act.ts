// Don't Act — blocks volitional UseAbility actions, allows reactions.
//
// Hooks `onActionAttempted` against the *actor's* hooks: when a unit
// attempts a UseAbility action, Don't Act returns
// `{ kind: 'blocked', reason: "can't act" }` and the engine refuses
// the action. Move and Wait still pass — Don't Act is "I can't *do
// things*," not "I can't take a turn." Charging spells fizzle at
// resolution because reduceChargedActionResolve runs the same
// onActionAttempted chain; this branch covers that case for free.
//
// Per ADR-0027, the runner forwards an `isReaction: boolean` flag.
// Reactions (Counter, Auto-Potion, future Earth Resilience) are
// reflexive, not volitional — Don't Act lets them through. Counter
// still fires on a Don't-Act-afflicted reactor; the narrative
// justification is "you can't *plan* to do anything, but reflexes
// still happen."
//
// Resistance tag: none in v1. If a future 'mental' or 'paralysis'
// resistance tag arrives, Don't Act would adopt it.

import {
  statusHook,
  statusTypeId,
  type StatusEffectType,
} from '@engine/index.ts';

export const dontAct: StatusEffectType = {
  id: statusTypeId('dont_act'),
  name: "Don't Act",
  tags: ['negative', 'mental'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  hooks: [
    statusHook('onActionAttempted', (args) => {
      if (args.action.type !== 'use_ability') return { kind: 'allowed' };
      // Reactions still fire — reflex vs. volition. Per ADR-0027.
      if (args.isReaction) return { kind: 'allowed' };
      return { kind: 'blocked', reason: "can't act" };
    }),
  ],
};
