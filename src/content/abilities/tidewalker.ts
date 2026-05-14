// Tidewalker — Water Mage's class-free Movement passive.
//
// `modifyTerrainCosts` chain handler: decrements (floor 1) the move-
// point cost of every terrain tagged `'water'` in the active ruleset's
// terrain registry (ADR-0073). On the v1 ruleset that's
// `water_shallow` (2 → 1) and `water_deep` (3 → 2); future water
// variants (frozen, currents) inherit the reduction automatically once
// they register the `'water'` tag.
//
// Note the canEnter caveat: Water Mage's class baseline adds
// `water_shallow` to canEnter (so Tidewalker's cost reduction matters);
// `water_deep` requires Float (or future Walk-on-Water) before the
// cost reduction is reachable in practice. Tidewalker reduces *cost*,
// not *eligibility*; the two passives compose cleanly.
//
// Cost-1 in v1: small, niche, and self-evidently "Water's mobility
// signature." Pairs naturally with Float on cross-classed builds.

import {
  abilityId,
  bucketId,
  mapTerrainCostsByTag,
  passiveHook,
  type PassiveAbilityDefinition,
} from '@engine/index.ts';

export const tidewalker: PassiveAbilityDefinition = {
  id: abilityId('tidewalker'),
  name: 'Tidewalker',
  kind: 'passive',
  bucket: bucketId('movement'),
  baseCost: 1,
  availability: 'available',
  tags: ['water'],
  hooks: [
    passiveHook('modifyTerrainCosts', (args) =>
      mapTerrainCostsByTag(args.baseValue, args.terrainRegistry, 'water', (c) =>
        Math.max(1, c - 1),
      ),
    ),
  ],
};
