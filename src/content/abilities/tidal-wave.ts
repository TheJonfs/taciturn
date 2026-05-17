// Tidal Wave — Water Mage's AoE spell.
//
// Charged tile-anchored AoE: a diamond r1 magical water damage with a
// per-target chance of knockback 1 tile. Knockback direction is uniform
// across all affected targets — caster→anchor cardinal vector — so a
// Tidal Wave cast east of the caster pushes everything in the AoE
// further east, parallel to the cast direction.
//
// Per session 18 plaintext review:
//   - power_coefficient 5, mpCost 14, actionSpeed 25 (parity with Earth
//     Quake's tier; lower power than Quake's 6 to budget for the
//     knockback rider)
//   - shape: diamond r1 (5 tiles: center + 4 cardinal neighbors;
//     Manhattan radius). Distinct silhouette from Earth Quake's cross.
//   - excludeCaster: true (default; FFT-canonical)
//   - friendly fire: per ruleset (v1 default true)
//   - vertical tolerance: 1 (default)
//   - knockback distance 1, baseChance 50 (Faith × MA factors land at
//     ~51% net per target against default-Faith enemies)
//   - range horizontal 4 / vertical 2, arc
//
// Knockback collision policy per ADR-0026: cancel at last legal tile.
// Targets backed against a wall / cliff don't move; falling damage
// applies on drops > 1 elevation.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const tidalWave: ActiveAbilityDefinition = {
  id: abilityId('tidal_wave'),
  name: 'Tidal Wave',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'water'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 2 },
    rangeMode: 'arc',
  },
  actionSpeed: 25,
  mpCost: 14,
  effects: {
    damage: {
      tags: ['magical', 'water'],
      power_coefficient: 7,
      knockback: {
        distance: 1,
        chance: 50,
      },
    },
    aoe: {
      shape: { kind: 'diamond', radius: 1 },
    },
  },
};
