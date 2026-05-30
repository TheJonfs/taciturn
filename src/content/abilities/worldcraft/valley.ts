// Valley — Worldcraft 3×3 area lower (Session 54). Lowers a 3×3 area around
// the target tile per the negated Hill kernel
//   [-1, -2, -1]
//   [-2, -3, -2]
//   [-1, -2, -1]
// (center -3, edges -2, corners -1) — a literal valley. Instant-cast; one
// `terrain` queue entry covering all nine tiles. 16 MP, range 4 / vertical-
// infinite.
//
// The drop deals fall damage per-tile immediately: a unit on the center
// takes the most (-3 → 30), edges 20, corners (±1) zero (the dropDistance > 1
// gate). Friendly fire applies — allies in the area fall too. The revert
// raises the tiles back, dealing nothing.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const valley: ActiveAbilityDefinition = {
  id: abilityId('valley'),
  name: 'Valley',
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
        { dx: -1, dy: -1, delta: -1 }, { dx: 0, dy: -1, delta: -2 }, { dx: 1, dy: -1, delta: -1 },
        { dx: -1, dy: 0, delta: -2 },  { dx: 0, dy: 0, delta: -3 },  { dx: 1, dy: 0, delta: -2 },
        { dx: -1, dy: 1, delta: -1 },  { dx: 0, dy: 1, delta: -2 },  { dx: 1, dy: 1, delta: -1 },
      ],
    },
  },
};
