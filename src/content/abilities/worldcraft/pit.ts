// Pit — Worldcraft single-tile sharp lower (Session 54; magnitude tuned
// -3 → -4 in S55). Lowers the target tile by -4 elevation. Instant-cast; one
// `terrain` queue entry. 8 MP, range 4 / vertical-infinite.
//
// The drop deals fall damage immediately (the terrain-change reducer emits
// `'falling'` damage for any occupant of a tile that drops > 1). The revert
// raises the tile back, so it deals nothing — the inverse of Pillar's
// asymmetry. Elevation is floored at 0 (deep-water table) by the resolver.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const pit: ActiveAbilityDefinition = {
  id: abilityId('pit'),
  name: 'Pit',
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
      deltas: [{ dx: 0, dy: 0, delta: -4 }],
    },
  },
};
