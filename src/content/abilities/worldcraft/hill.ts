// Hill — Worldcraft 3×3 area raise (Session 54). Raises a 3×3 area around
// the target tile per the kernel
//   [1, 2, 1]
//   [2, 3, 2]
//   [1, 2, 1]
// (center +3, edges +2, corners +1) — a literal hill. Instant-cast; one
// `terrain` queue entry covering all nine tiles. 16 MP, range 4 / vertical-
// infinite.
//
// The kernel is content data: per-tile elevation deltas relative to the
// anchor, applied by the terrain-change reducer (not an `aoe` footprint).
// Raises deal no fall damage; the revert drops them back, and corner tiles
// (±1) deal zero fall damage on revert (the natural dropDistance > 1 gate),
// while edges (±2 → 20) and center (±3 → 30) do.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const hill: ActiveAbilityDefinition = {
  id: abilityId('hill'),
  name: 'Hill',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['worldcraft'],
  targeting: {
    kind: 'tile',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
  },
  actionSpeed: 0,
  mpCost: 16,
  effects: {
    worldcraft: {
      kind: 'elevation',
      deltas: [
        { dx: -1, dy: -1, delta: 1 }, { dx: 0, dy: -1, delta: 2 }, { dx: 1, dy: -1, delta: 1 },
        { dx: -1, dy: 0, delta: 2 },  { dx: 0, dy: 0, delta: 3 },  { dx: 1, dy: 0, delta: 2 },
        { dx: -1, dy: 1, delta: 1 },  { dx: 0, dy: 1, delta: 2 },  { dx: 1, dy: 1, delta: 1 },
      ],
    },
  },
};
