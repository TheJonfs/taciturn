// Pillar — Worldcraft single-tile sharp raise (Session 54). Raises the
// target tile by +3 elevation. Instant-cast; adds one `terrain` entry to the
// Terraformer's effect queue (LIFO-evicted when over the cap, reverting with
// a drop — and a drop deals fall damage, the blueprint's raise/revert
// asymmetry). 8 MP, range 4 / vertical-infinite (magic-uniform per S47/S49).
//
// A raise deals no fall damage (the terrain-change reducer only punishes
// drops); the cost lands on the revert, when the lifted tile falls back.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const pillar: ActiveAbilityDefinition = {
  id: abilityId('pillar'),
  name: 'Pillar',
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
  mpCost: 8,
  effects: {
    worldcraft: {
      kind: 'elevation',
      deltas: [{ dx: 0, dy: 0, delta: 3 }],
    },
  },
};
