// Smolder — Fire Mage's Reaction.
//
// On taking damage from a non-healing-tagged hit, applies 1 stack of
// Burn to the attacker. The Burn stack snapshots the *reactor's* MA
// (the Fire Mage who got hit) at trigger time — a high-MA Fire Mage's
// reflective Burn hits hard. Per session 19 plaintext review.
//
// Numbers:
//   - baseCost 2 (mid-tier reaction; pulls a Burn stack onto the
//     attacker without a separate ability slot)
//   - Brave-gated trigger per ADR-0021 — fires probabilistically at
//     lower Brave; deterministic at Brave 100
//   - 1 stack of Burn applied via the reaction compiler's
//     `apply_status` effect kind with `stackQuantity: 1`
//
// Compiled via `compileReaction` (per ADR-0024). The emission is a
// `system_apply_status` with `sourceUnitId: reactor.id`, which Burn's
// `composeApplyState` reads to compute per-stack damage from the
// reactor's MA. The applier-tracking design means a Fire Mage with
// MA 9 reflects 5 dmg/stack worth of Burn; an MA 7 caster reflects
// 4 dmg/stack worth.

import {
  abilityId,
  bucketId,
  compileReactionAbility,
  statusTypeId,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const smolder: PassiveAbilityDefinition = compileReactionAbility(
  {
    id: abilityId('smolder'),
    name: 'Smolder',
    bucket: bucketId('reaction'),
    baseCost: 2,
    tags: ['magical', 'fire'],
  },
  {
    triggerOn: ['onActionTargeted'],
    triggerCondition: {
      type: 'damage_received',
      // Only triggers when actual damage lands. A whiffed swing doesn't
      // light the attacker on fire.
      minDamage: 1,
      damageTagsNone: ['healing'],
    },
    effects: [
      {
        kind: 'apply_status',
        statusTypeId: statusTypeId('burn'),
        targetSelector: 'attacker',
        stackQuantity: 1,
      },
    ],
  },
);
