// Float — Movement-bucket passive that flattens every terrain's move
// cost to `min(cost, 1)`. Demonstrates the cost-modifier hook surface
// (`modifyTerrainCosts`).
//
// Session 33.5: redesigned. Pre-S33 Float opened literal `'water'` to
// canEnter; S33 (ADR-0073) re-keyed it on the `'water'` tag. But under
// S33's universal-water-enter convention every class can already enter
// water at a cost penalty, so the canEnter-adding role became a no-op
// against the production catalog. Per Chris's call, Float is now the
// universal terrain-cost leveller: a Float-equipped unit pays at most 1
// per tile on *any* terrain. On River Ridge that drops water_shallow
// 2 → 1 and water_deep 3 → 1; it stays forward-compatible for future
// high-cost terrains (swamp, sand, mud) without touching this ability.
//
// Differentiation: Walk-on-Water (future content) is water-only; Fly
// (future content) is Float plus elevation-ignoring. Float is the
// generalist mobility passive — situationally strong on cost-varied
// maps, neutral on flat ones.
//
// Cost-1 in v1.

import {
  abilityId,
  bucketId,
  mapAllTerrainCosts,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const float: PassiveAbilityDefinition = {
  id: abilityId('float'),
  name: 'Float',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  hooks: [
    passiveHook('modifyTerrainCosts', (args) =>
      mapAllTerrainCosts(args.baseValue, args.terrainRegistry, (c) => Math.min(c, 1)),
    ),
  ],
};
