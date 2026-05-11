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
//   - excludeCaster: true (default; the caster sits at the cone's apex
//     and is naturally outside the affected rows, but the flag is
//     belt-and-suspenders)

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
    kind: 'tile',
    range: { horizontal: 4, vertical: 2 },
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
      shape: { kind: 'cone', rows: [1, 3, 3] },
      anchorMode: 'caster',
    },
  },
};
