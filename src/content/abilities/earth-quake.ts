// Earth Quake — Earth Mage's AoE spell.
//
// Charged tile-anchored AoE: a diamond-shape (radius 1: center + 4
// cardinal neighbors) magical earth damage with a Movement Debuff
// rider rolled independently per affected target.
//
// Per session 17b plaintext review:
//   - power 6, mpCost 14, actionSpeed 25 (slower than Strike's 30)
//   - shape: diamond radius 1 (session 26 — was `cross r1` pre-session-26;
//     the two are identical at r1 but Aether-Bloom-enlarged diamond r2
//     produces a 13-tile field vs cross r2's 9 tiles)
//   - excludeCaster: true (default; FFT-canonical)
//   - friendly fire: per ruleset (v1 default true)
//   - vertical tolerance: 1 (default; hits adjacent layers within ±1)
//   - debuff baseChance 50% per target, duration 24, tagged 'earth'
//   - range horizontal 4 / vertical 2, arc (parity with Strike)
//
// Why charged actionSpeed 25: slower than Strike (30) per the Earth
// identity of "the slow, weighty force." The AoE's larger reach is
// paid for in extra charge time and ~3× MP. Lands ~6 ticks after commit
// at the default speed bounds — usually after the caster's next turn,
// which makes positioning pre-cast meaningful.
//
// Per-target seed branching (session 17a) makes each target's Movement
// Debuff roll independent: target index 0 might land while target 1
// misses, even with the same baseChance.

import {
  abilityId,
  bucketId,
  statusTypeId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const earthQuake: ActiveAbilityDefinition = {
  id: abilityId('earth_quake'),
  // S40 name-update pass: display name 'Earthquake' (one word); id preserved.
  name: 'Earthquake',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'earth'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 14,
  effects: {
    damage: {
      tags: ['magical', 'earth'],
      power_coefficient: 7,
    },
    aoe: {
      shape: { kind: 'diamond', radius: 1 },
    },
    statusEffects: [
      {
        typeId: statusTypeId('movement_debuff'),
        target: 'primary_target',
        baseChance: 50,
        duration: 4,
      },
    ],
  },
};
