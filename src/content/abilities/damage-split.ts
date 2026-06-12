// Damage Split — the Terraformer's native Reaction (Session 53 substrate;
// wired onto the Terraformer's free slots in S54). When the wearer takes a
// damaging attack and survives, it splits the hit in two: half the damage
// bounces back at the attacker and the wearer heals the other half.
// (S-team-builder: halved the reflect per Chris's playtest — the original
// blueprint reflected the FULL amount; see ADR-0088's amendment.)
//
// Built on the `reflect_damage` reaction-effect kind (per ADR-0088):
//  - The reflected hit is a `system_damage` with the `'reflect'` source, so
//    it bypasses the seven-stage pipeline (no variance/Faith/resistance) and
//    — crucially — can't cascade into the attacker's own reactions. This
//    mirrors Spiked Mail's `'revenge'` bypass, distinguished only by being
//    Reaction-triggered (Brave-gated) rather than passive.
//  - Both halves are floor(damage / 2): a `system_damage` reflect at the
//    attacker and a paired `system_heal` on the wearer.
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
        // Split the surviving hit in two: half reflected at the attacker,
        // half healed on the reactor (per Chris's S-team-builder playtest
        // call; supersedes the blueprint's full-reflect).
        reflectNumerator: 1,
        reflectDenominator: 2,
        selfHealNumerator: 1,
        selfHealDenominator: 2,
      },
    ],
  },
);
