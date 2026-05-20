// Speed Save — Assassin's Reaction (Session 42). Free and native on the
// Assassin; cross-class costs 1.
//
// Trigger: hit by an enemy for damage (per S42 brief D5). Applies +1 to
// the `speed_save` accumulator status on self. The status' STACK_ADDITIVE
// rule sums each grant onto a single instance, so repeated hits ratchet
// the Assassin's Speed upward over the battle. Permanent + persists
// through KO (ADR-0079).
//
// Trigger gate (Combat Focus precedent, S39): `damage_received` with
// `minDamage: 1` and `damageTagsNone: ['healing']`. This realizes the
// D5 edge cases: a miss/evade deals no damage (no trigger); a status-
// only Command Set hit deals no damage (no trigger); a Counter-attack
// from a Counter-equipped target IS enemy damage (triggers). The
// runner's same-team filter ensures only enemy hits count.
//
// Note (D5 nuance): a Two-Weapons enemy landing both swings would
// propose Speed Save twice, but the ruleset's flat per-unit-per-turn
// reaction cap (`perUnitPerTurnReactions: 1`) throttles it to one grant
// per enemy turn. Honoring "once per swing" would need a per-ability cap
// override — out of scope for S42; flagged in the handoff.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const speedSaveReaction: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('speed_save'),
    name: 'Speed Save',
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
        statusTypeId: statusTypeId('speed_save'),
        targetSelector: 'self',
        magnitude: 1,
      },
    ],
  },
);
