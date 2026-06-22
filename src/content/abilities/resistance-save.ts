// Resistance Save — Enchanter's Reaction (S72). Free and native on the
// Enchanter; cross-class costs 1.
//
// Trigger: hit by magical damage. Applies +10 to the `resistance_save`
// accumulator status on self. STACK_ADDITIVE sums each grant onto a single
// instance, so repeated magical hits ratchet the unit's elemental
// resistances upward over the battle. Permanent + persists through KO
// (ADR-0079), uncapped by decision (S72 brief D3).
//
// Trigger gate (Speed Save / Cornered Focus precedent): `damage_received`
// with `damageTagsAny: ['magical']` (only magical hits arm it),
// `minDamage: 1` (a miss / fully-resisted 0 doesn't trigger), and
// `damageTagsNone: ['healing']` (a magical *heal* — Cure carries the
// 'magical' tag — never arms it; minDamage already excludes the negative
// "damage" of a heal, this is belt-and-suspenders). The runner's same-team
// filter ensures only enemy hits count.
//
// Tunable: the brief notes +10 may read modest in playtest — bump the
// reaction's magnitude (and the status default) if so.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const resistanceSaveReaction: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('resistance_save'),
    name: 'Resistance Save',
    bucket: bucketId('reaction'),
    baseCost: 1,
    availability: 'available',
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      minDamage: 1,
      damageTagsAny: ['magical'],
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'apply_status',
        statusTypeId: statusTypeId('resistance_save'),
        targetSelector: 'self',
        magnitude: 10,
      },
    ],
  },
);
