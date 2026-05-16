// Static Embrace — Lightning Mage's Buff.
//
// Charged ally-target buff that applies Crit_modifier (+20 crit_chance,
// permanent) on a Faith × MA roll. Mirrors Fire Embrace and Earth
// Blessing in shape (no damage component, gated by Faith × MA against
// `baseChance: 80`); the payoff is a permanent crit-chance shift on
// the recipient.
//
// Per session 20 plaintext review:
//   - mpCost 10, actionSpeed 25 (Buff tier — slightly faster than
//     Strike, parity with Fire Embrace)
//   - baseChance 80 → with v1 demo Faith 80 → ~64% expected apply
//   - magnitude 20 (matches Crit_modifier's defaultMagnitude;
//     declarative for visibility)
//   - range horizontal 3 / vertical 2, arc — parity with Fire Embrace
//   - Self-targeting allowed (single_unit; no team filter): the
//     Lightning Mage casting Static Embrace on themselves before a
//     Storm Caller is the natural use case.
//
// Permanent durationMode (per session 19 PA Up / MA Up precedent) —
// direct stat shifts persist for the remainder of the battle.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const staticEmbrace: ActiveAbilityDefinition = {
  id: abilityId('static_embrace'),
  name: 'Static Embrace',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 3, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 10,
  effects: {
    statusEffects: [
      {
        typeId: statusTypeId('crit_modifier'),
        target: 'primary_target',
        baseChance: 80,
        magnitude: 20,
      },
    ],
  },
};
