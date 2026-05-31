// Maelstrom — Water Mage's Ultimate.
//
// Charged caster-anchored cone AoE. Magical water damage in a 3-deep
// cone projected from the caster's tile toward the targeted tile, with
// a *deterministic* knockback 1 on every affected target. No Faith roll
// on the knockback — it always lands, modulo the collision policy.
//
// First content consumer of:
//   - The cone AoE shape (`{ kind: 'cone', rows: [1, 3, 3] }`)
//   - The `anchorMode: 'caster'` AoE flag (cone projects from the caster,
//     direction derived from caster→targeted-tile cardinal)
//   - Deterministic knockback (no `chance` on the knockback rider)
//
// Cone geometry (rows: [1, 3, 3]):
//
//     . X X X .         d=3: 3 tiles
//     . X X X .         d=2: 3 tiles
//     . . X . .         d=1: 1 tile (directly forward)
//     . . C . .         caster anchor
//
// Cone snaps to the nearest cardinal direction of the caster→target
// vector (per `cardinalFromTo`). The blueprint is parameterized by row
// widths so a future "more affecting Maelstrom" variant can swap to
// `[1, 3, 5]` without a shape redefinition.
//
// Per session 18 plaintext review:
//   - power_coefficient 7, mpCost 28, actionSpeed 18 (slowest tier;
//     parity with Earth Cataclysm's Ultimate slot)
//   - range horizontal 4 / vertical 2, arc (target tile picks direction;
//     the cone itself is anchored at the caster)
//   - knockback distance 1, no chance gate (always knocks back)
//   - excludeCaster: false (S55) — moot for a cone: the apex (caster tile) is
//     never in the footprint, which starts one tile ahead

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const maelstrom: ActiveAbilityDefinition = {
  id: abilityId('maelstrom'),
  name: 'Maelstrom',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['magical', 'water'],
  targeting: {
    kind: 'unit_or_tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 18,
  mpCost: 28,
  effects: {
    damage: {
      tags: ['magical', 'water'],
      power_coefficient: 12,
      knockback: {
        distance: 1,
        // chance omitted → fires deterministically on every hit target
      },
    },
    aoe: {
      // S55 (supersedes ADR-0025 #7 for offensive AoE): the caster CAN be caught
      // in their own offensive blast. Target-anchored shapes now hit the caster if
      // the footprint reaches their tile; caster-anchored cone/line footprints
      // start one tile ahead, so this is a no-op for those two.
      excludeCaster: false,
      shape: { kind: 'cone', rows: [1, 3, 3] },
      anchorMode: 'caster',
    },
  },
};
