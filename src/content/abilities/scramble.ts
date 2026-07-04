// Scramble — Hunter Marksmanship command (Session 45). A short repositioning
// hop: the Hunter leaps to an adjacent tile, ignoring the normal jump
// limit (delta 5), for the cost of an action only.
//
// Implemented via the `selfMove` effect (the knockback-style in-reduce
// relocation, applied to the caster). The reach and the relaxed leap live
// entirely in the targeting range — horizontal 1 (adjacent), vertical 5
// (the leap cap). Validation additionally requires the destination to be
// enterable terrain for the Hunter's class and free of any other unit.
// No damage; its value is escaping a melee threat the bow's 2-tile
// minimum range can't answer, or hopping onto the high ground the
// Hunter's height-delta variance rewards. mpCost 2 — a light tax so the
// repositioning hop isn't a free every-turn reset.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const scramble: ActiveAbilityDefinition = {
  id: abilityId('scramble'),
  name: 'Scramble',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  targeting: {
    kind: 'tile',
    range: { horizontal: 1, vertical: 5 },
    rangeMode: 'melee',
  },
  actionSpeed: 0,
  mpCost: 2,
  effects: { selfMove: true },
};
