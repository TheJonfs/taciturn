// Counter — the canonical reaction passive. Hooks `onActionTargeted`:
// when the unit is targeted by another unit's physical UseAbility,
// proposes a single basic Attack against the attacker. The reaction
// enters the action chain via the reducer's `generatedReactions` field
// and is tagged `isReaction: true` so the per-unit-per-turn reaction
// cap applies.
//
// Gating (session 14: matches FFT — fires on attempt regardless of
// damage outcome; the Brave roll filters probabilistically):
//  - The incoming action must be a UseAbility (Counter doesn't fire on
//    non-attack actions like Move).
//  - The 'physical' tag is present (Counter is the physical-reaction
//    archetype; Magic Counter / Counter Magic are separate passives).
//  - Healing-tagged effects don't trigger Counter (a Cure that's tagged
//    physical+healing for some future class wouldn't trigger).
//  - The attacker is identifiable from the incoming action's actorId.
//  - The reactor isn't the attacker (defensive against future self-
//    targeting damage abilities).
//
// **No `damageDealt > 0` gate.** Misses on physical attacks still
// trigger Counter — the reactor counters the *attempt* (FFT-faithful
// per the Battle Mechanics Guide's "Reaction trigger chance" section).
// The probabilistic Brave roll inside `runOnActionTargeted` is the
// effective filter; demo units at Brave 100 trigger deterministically.
//
// (Earlier sessions gated Counter on `damageDealt > 0`. ADR-0019's
// original "Reactions still trigger on hit, not on miss" consequence
// was superseded in session 14 — see ADR-0021.)

import {
  abilityId,
  bucketId,
  passiveHook,
  type PassiveAbilityDefinition,
  type ProposedAction,
} from '@engine/index.ts';

export const counter: PassiveAbilityDefinition = {
  id: abilityId('counter'),
  name: 'Counter',
  kind: 'passive',
  bucket: bucketId('reaction'),
  baseCost: 1,
  hooks: [
    passiveHook('onActionTargeted', (args) => {
      const tags = args.damageTags;
      if (!tags?.has('physical')) return [];
      if (tags.has('healing')) return [];
      const incoming = args.incomingAction;
      if (incoming.type !== 'use_ability') return [];
      if (!('actorId' in incoming)) return [];
      if (incoming.actorId === args.unit.id) return [];
      const counterAttack: ProposedAction = {
        type: 'use_ability',
        source: 'system',
        actorId: args.unit.id,
        payload: {
          abilityId: abilityId('attack'),
          target: { kind: 'unit', unitId: incoming.actorId },
        },
      };
      return [counterAttack];
    }),
  ],
};
