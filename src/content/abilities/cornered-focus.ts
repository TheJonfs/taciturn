// Cornered Focus — the Calculator's Reaction (Session 49). Free and
// native on the Calculator; cross-class costs 1.
//
// Trigger: hit by an enemy for damage (Speed Save / Updraft precedent).
// Applies +1 to the `cornered_focus` accumulator status on self. The
// status' STACK_ADDITIVE rule sums each grant onto a single instance,
// so repeated hits ratchet the Calculator's MA upward over the battle.
// Permanent + persists through KO (ADR-0079). Per-enemy-turn cap from
// the ruleset's flat `perUnitPerTurnReactions: 1` throttle (the same
// limit Speed Save / Updraft inherit — S42 D5 carry).
//
// Flavor (per Chris): "more focus on a problem as you approach a
// deadline / are under pressure." The Calculator's analytical edge
// sharpens with the threat.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const corneredFocusReaction: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('cornered_focus'),
    name: 'Cornered Focus',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      minDamage: 1,
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'apply_status',
        statusTypeId: statusTypeId('cornered_focus'),
        targetSelector: 'self',
        magnitude: 1,
      },
    ],
  },
);
