// Don't Move — blocks volitional Move actions.
//
// Hooks `onActionAttempted` against the *actor's* hooks: when a unit
// attempts a Move action, Don't Move returns
// `{ kind: 'blocked', reason: "can't move" }` and the engine refuses
// the action. UseAbility, Wait, SetFacing all pass.
//
// **Forced movement is not blocked by Don't Move.** Knockback (per
// ADR-0026) calls `applyKnockback` which moves the unit's position
// directly — it does not commit a Move action through the reducer.
// Don't Move only gates the volitional Move action surface; involuntary
// displacement is orthogonal.
//
// Movement-modifying passives (Move +1, Float, Fly) compose orthogonally
// with Don't Move. The passives modify *how* the unit moves; Don't Move
// blocks the act of moving. When Don't Move clears, the passives are
// still attached — no interaction between them.
//
// Resistance tag: none in v1. If a future 'paralysis' or 'physical'
// (in the status-tag sense) resistance arrives, Don't Move would adopt it.

import {
  statusHook,
  statusTypeId,
  type ActionAttemptResult,
  type StatusEffectType,
} from '@engine/index.ts';

export const dontMove: StatusEffectType = {
  id: statusTypeId('dont_move'),
  name: "Don't Move",
  tags: ['negative', 'physical'],
  durationMode: 'per_unit_ct',
  stackingRule: 'REFRESH',
  aiHints: { polarity: 'debuff', value: 15 },
  hooks: [
    statusHook('onActionAttempted', (args): ActionAttemptResult => {
      if (args.action.type !== 'move') return { kind: 'allowed' };
      return { kind: 'blocked', reason: "can't move" };
    }),
  ],
};
