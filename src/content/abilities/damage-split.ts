// Damage Split — the Terraformer's native Reaction (Session 53 substrate;
// wired onto the Terraformer's free slots in S54). When the wearer takes a
// damaging attack and survives, it bounces the damage back at the attacker
// and heals the wearer for half of it.
//
// Built on the `reflect_damage` reaction-effect kind (per ADR-0088):
//  - The reflected hit is a `system_damage` with the `'reflect'` source, so
//    it bypasses the seven-stage pipeline (no variance/Faith/resistance) and
//    — crucially — can't cascade into the attacker's own reactions. This
//    mirrors Spiked Mail's `'revenge'` bypass, distinguished only by being
//    Reaction-triggered (Brave-gated) rather than passive.
//  - The self-heal is a paired `system_heal` for floor(damage / 2).
//
// Gating:
//  - `damage_received` with `minDamage: 1` and `damageTagsNone: ['healing']`
//    — fires only on a non-healing hit that actually landed damage.
//  - Survival is gated inside the effect (the reactor must be alive after
//    the hit); the runner's Brave roll then decides whether it fires.
//
// Equip cost 2 SP per the blueprint.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const damageSplit: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('damage_split'),
    name: 'Damage Split',
    bucket: bucketId('reaction'),
    baseCost: 2,
    availability: 'available',
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      // Only fires on a hit that actually landed damage; healing-tagged
      // applications don't trigger.
      minDamage: 1,
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'reflect_damage',
        // Pure bypass — the `'reflect'` source already attributes the log;
        // no tag is needed for resistance (system_damage skips it).
        tags: [],
        selfHealNumerator: 1,
        selfHealDenominator: 2,
      },
    ],
  },
);
