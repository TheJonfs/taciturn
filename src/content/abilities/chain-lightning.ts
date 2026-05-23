// Chain Lightning — Lightning Mage's AoE.
//
// Charged tile-anchored AoE magical lightning damage on a diamond r1
// shape (5 tiles). The hook is `damage.chainBonus`: the effective
// `power_coefficient` scales with cluster size — every additional
// target hit adds +1 to the per-target power. With 1 target hit
// (clipped cluster) it's power 8; 2 targets = 9 each; 3 = 10 each;
// 4 = 11 each. The boost is uniform across the cluster (every target
// in a 3-cluster sees power 10), not "per-target's-position chained
// damage."
//
// Per session 20 plaintext review:
//   - base power_coefficient 8, +1 per additional target via
//     chainBonus.powerPerAdditionalTarget
//   - mpCost 14, actionSpeed 25 (mid-tier AoE — parity with
//     Fire Storm and Earth Quake)
//   - range horizontal 4 / vertical 2, arc (target tile)
//   - shape diamond r1 — symmetric, no cardinal bias
//   - excludeCaster: true (FFT-canonical default — and the Lightning
//     Mage probably shouldn't be on top of their own AoE anyway)
//
// Friendly fire follows ruleset default (true in v1) — Chain Lightning
// hits allies caught in the AoE, which actually *boosts* damage to
// other targets via the chainBonus. Tactical positioning matters.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const chainLightning: ActiveAbilityDefinition = {
  id: abilityId('chain_lightning'),
  name: 'Chain Lightning',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'lightning'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 14,
  effects: {
    damage: {
      tags: ['magical', 'lightning'],
      power_coefficient: 9,
      chainBonus: { powerPerAdditionalTarget: 1 },
    },
    aoe: {
      shape: { kind: 'diamond', radius: 1 },
    },
  },
};
