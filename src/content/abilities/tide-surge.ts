// Tide Surge — Water Mage's Buff.
//
// Charged single-target ally CT push. No damage, no status — just a
// Faith-chance roll that, on success, bumps the ally's CT by
// `floor(2 × caster.MA)`. First content consumer of the free-standing
// `effects.ctEffects` shape (per session 18).
//
// Per session 18 plaintext review:
//   - mpCost 10, actionSpeed 25 (faster than Strike — buffs come online
//     quicker, parallel to Earth's Blessing pattern)
//   - baseChance 80 (Faith × MA factors at default Faith 80 / MA 7
//     bring net hit rate to ~82%, well inside the 75-90% target band)
//   - factor +2 (ally CT += 2 × MA on success)
//   - range horizontal 4 / vertical 2, arc
//   - target = primary_target (single ally; self-targeting also legal
//     since v1 has no friendly-fire-style filter on ctEffects)
//
// Tactical comparison vs. Earth Blessing: Blessing applies Regen (sustained
// HoT) at near-100% chance; Tide Surge applies a one-shot CT shove at a
// lower chance. Different shape — Blessing scales with battle length;
// Surge produces an immediate tempo swing on success.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const tideSurge: ActiveAbilityDefinition = {
  id: abilityId('tide_surge'),
  name: 'Tide Surge',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  tags: ['magical', 'water'],
  targeting: {
    kind: 'single_unit',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 10,
  effects: {
    ctEffects: [
      {
        target: 'primary_target',
        factor: 2,
        baseChance: 80,
      },
    ],
  },
};
