// Counter — the canonical session-8 reaction passive. Hooks
// `onActionTargeted`: when the unit takes physical damage from another
// unit's UseAbility, returns a single basic Attack proposed against the
// attacker. The reaction enters the action chain via the reducer's
// `generatedReactions` field and is tagged `isReaction: true` so the
// per-unit-per-turn reaction cap applies.
//
// Gating:
//  - The incoming action must be a UseAbility (Counter doesn't fire on
//    non-attack actions like Move).
//  - Damage was actually dealt (`damageDealt > 0`); a fully-blocked or
//    healing-tagged action doesn't trigger Counter.
//  - The 'physical' tag is present (Counter is the physical-reaction
//    archetype; Magic Counter / Counter Magic land separately).
//  - The attacker is identifiable from the incoming action's actorId.

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
      if (args.damageDealt === undefined || args.damageDealt <= 0) return [];
      if (!args.damageTags?.has('physical')) return [];
      const incoming = args.incomingAction;
      if (incoming.type !== 'use_ability') return [];
      if (!('actorId' in incoming)) return [];
      // Don't counter your own attack (defensive against future
      // self-targeting damage abilities).
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
