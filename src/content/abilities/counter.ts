// Counter — the canonical reaction passive. Refactored in session 16
// to use the spec-driven reaction compiler (per ADR-0017 / ADR-0024)
// instead of a hand-coded passive hook. The compiler translates the
// declarative `ReactionAbilityFields` into the same
// `PassiveHookRegistration[]` shape the engine consumed before.
//
// Gating (BMG-faithful, per ADR-0021):
//  - The incoming action must carry the `'physical'` damage tag.
//  - The `'healing'` tag excludes (Cures tagged physical+healing for
//    some future class don't trigger Counter).
//  - `minDamage: 0` means "trigger on attempt regardless of landed
//    damage" — misses on physical attacks still trigger Counter; the
//    Brave roll inside `runOnActionTargeted` is the effective filter.
//  - The reactor isn't the attacker (defensive against future
//    self-targeting damage abilities) — the compiler handles this.
//
// The compiled emission is a `use_ability` ProposedAction with the
// `attack` ability targeting the attacker. The reactor is the actor.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const counter: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('counter'),
    name: 'Counter',
    bucket: bucketId('reaction'),
    baseCost: 1,
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      damageTagsAny: ['physical'],
      damageTagsNone: ['healing'],
      // BMG-faithful: trigger on attempt regardless of damage. The
      // Brave roll gates probabilistically.
      minDamage: 0,
    },
    effects: [
      {
        kind: 'use_ability',
        abilityId: abilityId('attack'),
        targetSelector: 'attacker',
      },
    ],
  },
);
