// Tidal Pull — Water Mage's Reaction.
//
// On taking damage from a non-healing-tagged hit, self-CT += 20.
// First content consumer of the reaction compiler's `ct_push` effect
// kind (added session 18). Brave-gated trigger per ADR-0021 — fires
// probabilistically at lower Brave; deterministic at Brave 100.
//
// Per session 18 plaintext review:
//   - baseCost 1
//   - trigger: damage_received with minDamage 1 (only on actual damage,
//     parallel to Earth Resilience), damageTagsNone ['healing']
//   - effect: ct_push targetSelector 'self', delta +20
//
// Tactical comparison vs. Earth Resilience: Resilience self-buffs Move/
// Jump (+1/+1, stacks). Tidal Pull skips the stat layer entirely and
// operates directly on the CT economy — getting hit pulls the Water
// Mage's next turn forward by ~20 CT, often letting them retaliate
// before the attacker's next move resolves.
//
// Per-turn reaction-cap accounting: rides the existing ruleset cap; the
// runner stamps `reactorId: args.unit.id` so commit-time accounting
// counts cap-against-Water-Mage even though the action is `system_ct_push`.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const tidalPull: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('tidal_pull'),
    name: 'Tidal Pull',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
    tags: ['magical', 'water'],
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
        kind: 'ct_push',
        targetSelector: 'self',
        delta: 20,
      },
    ],
  },
);
