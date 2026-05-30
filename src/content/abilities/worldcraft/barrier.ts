// Barrier — Worldcraft line of destructible walls (Session 54). Spawns a
// Barrier object on each tile of a contiguous straight line of 3-5 tiles
// (horizontal or vertical; the player picks orientation + length). Each tile
// must be unoccupied and barrier-free. Instant-cast; ONE `barrier` queue
// entry for the whole line (reverting clears all tiles at once). 12 MP, range
// 4 / vertical-infinite.
//
// Each barrier has HP = caster PA × MA (read computed, so Battle Dictionary's
// +1 PA composes — the first class where the Terraformer's PA pays off) and a
// 5-turn TTL. Barriers are impassable and block line-of-sight; they take
// damage from basic attacks and AoE (S54 barrier-damage routing) and are
// destroyed at HP 0. The TTL ticks each turn regardless of the owner's state
// (KO/Stop), but the effect is still subject to cap LIFO eviction.

import {
  abilityId,
  bucketId,
  type ActiveAbilityDefinition,
} from '@engine/index.ts';

export const barrier: ActiveAbilityDefinition = {
  id: abilityId('barrier'),
  name: 'Barrier',
  kind: 'active',
  bucket: bucketId('first_action'),
  baseCost: 1,
  availability: 'available',
  tags: ['worldcraft'],
  targeting: {
    kind: 'tile_set',
    range: { horizontal: 4, vertical: 99 },
    rangeMode: 'arc',
    minLength: 3,
    maxLength: 5,
  },
  actionSpeed: 0,
  mpCost: 12,
  effects: {
    worldcraft: {
      kind: 'barrier',
      ttl: 5,
    },
  },
};
