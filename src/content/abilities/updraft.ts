// Updraft — the Hunter's Reaction (Session 45). Free and native on the
// Hunter; cross-class costs 1.
//
// Trigger: hit by an enemy for damage. Applies +1 to the `updraft`
// accumulator status on self (STACK_ADDITIVE → a running +N Jump that
// ratchets up over the battle, permanent + KO-persistent). The
// Jump-axis sibling of the Assassin's Speed Save — same trigger gate
// (`damage_received`, minDamage 1, not healing), same accumulation
// mechanism, and the same per-unit-per-turn reaction cap throttles it to
// one grant per enemy turn (a multi-swing attacker proposes it per swing,
// but only one lands).

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const updraftReaction: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('updraft'),
    name: 'Updraft',
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
        statusTypeId: statusTypeId('updraft'),
        targetSelector: 'self',
        magnitude: 1,
      },
    ],
  },
);
