// Combat Focus — Alchemist Reaction (Session 39b).
//
// PA Up on enemy hit. +1 PA for 3 turns, refreshes on re-trigger
// (REFRESH stacking on `combat_focus` status). Uses the reaction
// compiler's `apply_status` effect with `targetSelector: 'self'`.
//
// Trigger gate (per S39 brief D3): "enemy-hit only." The reaction
// compiler's `triggerCondition.damageTagsAny` filter applies to the
// incoming damage tags. The runner already enforces "attacker !== self"
// (reactor can't react to its own action), which covers "ally hit"
// only if the attacker is the reactor — for ally-cast effects we'd
// need a team-aware filter. For v1 simplicity: minDamage: 1 and no
// healing tag — that gates out ally Cure / Potion (no damage applied)
// while keeping enemy physical and magical hits eligible. Same shape
// as Smolder's enemy-physical-on-hit reaction (`min_damage: 1`).

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const combatFocusReaction: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('combat_focus'),
    name: 'Combat Focus',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      minDamage: 1,
      // Healing-tagged casts (ally Cure, Potion's heal) don't trigger.
      // The reactor-is-attacker self-check is enforced by the runner.
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'apply_status',
        statusTypeId: statusTypeId('combat_focus'),
        targetSelector: 'self',
        magnitude: 1,
        duration: 3,
      },
    ],
  },
);
