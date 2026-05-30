// Barrier — Worldcraft line of destructible walls (Session 54). Spawns a
// Barrier object on each tile of a contiguous straight line of 3-5 tiles
// (horizontal or vertical; the player picks orientation + length). Each tile
// must be unoccupied and barrier-free. Instant-cast; ONE `barrier` queue
// entry for the whole line (reverting clears all tiles at once). 12 MP, range
// 4 / vertical-infinite.
//
// Each barrier has HP = caster PA × MA (read computed, so Battle Dictionary's
// +1 PA composes — the first class where the Terraformer's PA pays off) and a
// 50-turn TTL. The TTL ticks once per turn_start regardless of the owner's
// state (KO/Stop — ADR-0089); at ~10 turn-starts per round in a 5v5, 50 ≈
// 5 full rounds, the blueprint's intended lifetime. (Lifetime scales
// inversely with party size — a tunable property of the per-turn cadence.)
// Barriers are impassable and block line-of-sight; they take damage from
// basic attacks and AoE (S54 barrier-damage routing) and are destroyed at
// HP 0. Still subject to cap LIFO eviction.

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
      // ~5 full rounds in a 5v5 (≈10 turn_starts/round). See ADR-0089 +
      // playtest-watch on the per-turn cadence and party-size dependence.
      ttl: 50,
    },
  },
};
