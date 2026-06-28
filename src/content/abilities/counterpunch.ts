// Counterpunch (Session 76) — the Monk's innate Reaction. On taking a
// non-healing PHYSICAL hit, swing back with `counterpunch_strike` (PA × 4
// physical, a PA-scaled knockback chance). Brave-gated like every reaction.
//
// Melee-only falls out of the strike's range-1: the emitted counter has a
// 1-tile reach, so a counter against a ranged or repositioned attacker
// fizzles at validation (the "ranged doesn't trigger it" intent). Magic is
// filtered out directly (`damageTagsAny: ['physical']`), matching Counter.
//
// baseCost 1 (free for the Monk). Built with the reaction compiler, mirroring
// Counter — but it emits a dedicated PA² ... no: a PA × 4 strike (NOT weapon-
// tagged, so the unarmed WP=1 keeps it at PA × 4, not the punch's PA²),
// instead of re-emitting the basic Attack.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const counterpunch: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('counterpunch'),
    name: 'Counterpunch',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      damageTagsAny: ['physical'],
      damageTagsNone: ['healing'],
      // Trigger on attempt regardless of landed damage (BMG-faithful, as
      // Counter); the Brave roll inside `runOnActionTargeted` is the gate.
      minDamage: 0,
    },
    effects: [
      {
        kind: 'use_ability',
        abilityId: abilityId('counterpunch_strike'),
        targetSelector: 'attacker',
      },
    ],
  },
);
